#!/usr/bin/env python3
"""Detached resilient 0.1.5 upload: reconnect every CHUNK bytes, write to real disk."""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from base64 import b64encode
from datetime import datetime, timezone
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP") or os.environ.get("ASSISTIX_SSH_PASS") or "YOUR_SSH_PASSWORD_HERE"
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN") or "YOUR_UPDATE_TOKEN_HERE"

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.5"
EXE = "Beam-Agent-0.1.5-Setup.exe"
LOCAL = ROOT / "dist" / "installers" / EXE
HTML = ROOT / "desktop" / "installer" / "download-index.html"
AGENT = "/var/www/u3354161/data/www/agent.assistix.org"
DOWNLOAD = f"{AGENT}/download"
UPDATES = f"{AGENT}/updates"
API = f"{AGENT}/api"
# Real disk (NOT tmpfs /tmp) — partial then rename
REMOTE_PARTIAL = f"{DOWNLOAD}/{EXE}.partial"
REMOTE_FINAL = f"{DOWNLOAD}/{EXE}"
CHUNK = 8 * 1024 * 1024  # reconnect every 8MB
LOG = ROOT / "desktop" / "_chunk_upload_015.log"


def log(msg: str) -> None:
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def sha512_b64(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return b64encode(h.digest()).decode("ascii")


def sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username=USER,
        password=PASS,
        timeout=45,
        banner_timeout=120,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = c.open_sftp()
    try:
        sftp.get_channel().settimeout(10 * 60)
    except Exception:
        pass
    return c, sftp


def remote_size(sftp, path: str) -> int:
    try:
        return int(sftp.stat(path).st_size)
    except IOError:
        return 0


def run(c, cmd, timeout=180) -> str:
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        log(f"stderr: {err[:300]}")
    return out


def put_text(sftp, remote: str, text: str) -> None:
    with sftp.file(remote, "w") as f:
        f.write(text)


def upload_all(total: int) -> None:
    while True:
        c = sftp = None
        try:
            c, sftp = connect()
            offset = remote_size(sftp, REMOTE_PARTIAL)
            if offset > total:
                log(f"partial oversized {offset} > {total}, truncating")
                sftp.remove(REMOTE_PARTIAL)
                offset = 0
            if offset == total:
                log("partial already complete")
                sftp.close()
                c.close()
                return
            end = min(offset + CHUNK, total)
            log(f"session upload {offset}..{end} / {total} ({100*offset//total}%)")
            with LOCAL.open("rb") as lf, sftp.file(REMOTE_PARTIAL, "ab" if offset else "wb") as rf:
                lf.seek(offset)
                rf.set_pipelined(True)
                sent = offset
                while sent < end:
                    n = min(256 * 1024, end - sent)
                    chunk = lf.read(n)
                    if not chunk:
                        break
                    rf.write(chunk)
                    sent += len(chunk)
                rf.flush()
            got = remote_size(sftp, REMOTE_PARTIAL)
            log(f"session done remote={got} ({100*got//total}%)")
            sftp.close()
            c.close()
            if got >= total:
                return
            time.sleep(0.4)
        except Exception as e:
            log(f"reconnect after error: {e}")
            try:
                if sftp:
                    sftp.close()
            except Exception:
                pass
            try:
                if c:
                    c.close()
            except Exception:
                pass
            time.sleep(2)


def activate(size: int, digest: str, digest256: str) -> None:
    c, sftp = connect()
    release = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    notes = (
        "0.1.5: fix Desktop Host ready timeout (boot waits host+auth only), "
        "soft runtime version drift, splash/boot caps, bridge :17865, stability tray."
    )
    feed = (
        f"version: {VERSION}\n"
        f"files:\n"
        f"  - url: {EXE}\n"
        f"    sha512: {digest}\n"
        f"    size: {size}\n"
        f"path: {EXE}\n"
        f"sha512: {digest}\n"
        f"releaseDate: '{release}'\n"
    )
    manifest = {
        "ok": True,
        "version": VERSION,
        "releaseDate": release,
        "notes": notes,
        "changelog": notes,
        "file": EXE,
        "stableFile": "Beam-Agent-Setup.exe",
        "size": size,
        "sha512": digest,
        "sha256": digest256,
        "downloadUrl": f"https://agent.assistix.org/download/{EXE}",
        "channel": "nightly",
        "minAppVersion": None,
        "feedFile": EXE,
    }

    # Deploy APIs
    api = ROOT / "desktop" / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        p = api / name
        if p.is_file():
            sftp.put(str(p), f"{API}/{name}")
            log(f"api {name}")

    log("server-side copy/rename")
    out = run(
        c,
        f"""set -e
test -f {REMOTE_PARTIAL}
test $(stat -c%s {REMOTE_PARTIAL}) -eq {size}
mv -f {REMOTE_PARTIAL} {REMOTE_FINAL}
cp -f {REMOTE_FINAL} {DOWNLOAD}/Beam-Agent-Setup.exe
cp -f {REMOTE_FINAL} {UPDATES}/{EXE}
cp -f {REMOTE_FINAL} {UPDATES}/Beam-Agent-Setup.exe
# remove superseded latest-only clutter optional keep 0.1.4 file but feeds point to 0.1.5
ls -la {REMOTE_FINAL} {UPDATES}/{EXE}
""",
        timeout=300,
    )
    log(out.strip()[:500])

    put_text(sftp, f"{DOWNLOAD}/nightly.yml", feed)
    put_text(sftp, f"{DOWNLOAD}/latest.yml", feed)
    put_text(sftp, f"{UPDATES}/nightly.yml", feed)
    put_text(sftp, f"{UPDATES}/latest.yml", feed)
    put_text(sftp, f"{UPDATES}/manifest.json", json.dumps(manifest, indent=2) + "\n")
    log("feeds+manifest written")

    if HTML.is_file():
        html = HTML.read_text(encoding="utf-8")
        for old in ("0.1.4", "0.1.3-early-alpha", "0.1.3"):
            html = html.replace(old, VERSION)
        put_text(sftp, f"{DOWNLOAD}/index.html", html)
        log("index.html written")

    body = {
        "version": VERSION,
        "notes": notes,
        "channel": "nightly",
        "packagePath": REMOTE_FINAL,
        "file": EXE,
    }
    put_text(sftp, f"{DOWNLOAD}/_publish_015.json", json.dumps(body))
    pub = run(
        c,
        "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        "-H 'Content-Type: application/json' "
        f"-H 'X-Beam-Update-Token: {TOKEN}' "
        f"--data-binary @{DOWNLOAD}/_publish_015.json",
        timeout=180,
    )
    log(f"publish-api: {pub[:800]}")

    for url in (
        "https://agent.assistix.org/download/nightly.yml",
        "https://agent.assistix.org/api/check-update.php?current=0.1.4",
        "https://agent.assistix.org/updates/manifest.json",
    ):
        log(f"VERIFY {url}")
        log(run(c, f"curl -sS {url!r} | head -c 500")[:500])

    log(
        run(
            c,
            "curl -sS 'https://agent.assistix.org/download/' | tr -d '\\r' | grep -E '0\\.1\\.|Setup\\.exe|badge|verLine' | head -20",
        )[:800]
    )
    sftp.close()
    c.close()
    log("SHIPPED 0.1.5")


def main() -> int:
    if LOG.exists():
        LOG.write_text("", encoding="utf-8")
    if not LOCAL.is_file():
        log(f"missing {LOCAL}")
        return 1
    size = LOCAL.stat().st_size
    log(f"START local={size} chunk={CHUNK}")
    digest = sha512_b64(LOCAL)
    digest256 = sha256_hex(LOCAL)
    log(f"sha512={digest[:32]}...")
    upload_all(size)
    activate(size, digest, digest256)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        log(f"FATAL {e}")
        raise
