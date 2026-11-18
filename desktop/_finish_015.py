#!/usr/bin/env python3
"""Resume 0.1.5 binary upload if needed, then activate download+update channel."""
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
PASS = os.environ.get("BP") or "mBvnX4CGq1w74JRF"
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
REMOTE_TMP = f"/tmp/{EXE}"
EXPECTED = 421072171


def sha512_b64(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return b64encode(h.digest()).decode("ascii")


def sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
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
        sftp.get_channel().settimeout(2 * 60 * 60)
    except Exception:
        pass
    return c, sftp


def remote_size(sftp, path: str) -> int:
    try:
        return sftp.stat(path).st_size
    except IOError:
        return -1


def put_resume(sftp, local: Path, remote: str, total: int) -> None:
    offset = 0
    cur = remote_size(sftp, remote)
    if cur == total:
        print(f"complete {remote}", flush=True)
        return
    if cur > 0:
        offset = cur
        print(f"resume {remote} from {offset}", flush=True)
    else:
        offset = 0
        print(f"fresh upload {remote}", flush=True)

    with local.open("rb") as lf, sftp.file(remote, "ab" if offset else "wb") as rf:
        if offset:
            lf.seek(offset)
        rf.set_pipelined(True)
        sent = offset
        last = -1
        while True:
            chunk = lf.read(512 * 1024)
            if not chunk:
                break
            rf.write(chunk)
            sent += len(chunk)
            pct = int(sent * 100 / total)
            if pct != last and (pct % 1 == 0 or sent == total):
                last = pct
                print(f"  {sent/(1024*1024):.1f}/{total/(1024*1024):.1f} MB ({pct}%)", flush=True)
        rf.flush()
    got = remote_size(sftp, remote)
    if got != total:
        raise RuntimeError(f"size mismatch {got} != {total}")
    print("upload complete", flush=True)


def run(c, cmd, timeout=180):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("stderr:", err[:400], flush=True)
    return out


def put_text(sftp, remote, text):
    with sftp.file(remote, "w") as f:
        f.write(text)


def activate(c, sftp, size, digest, digest256):
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
        "downloadUrl": f"https://agent.assistix.org/updates/{EXE}",
        "channel": "nightly",
        "minAppVersion": None,
        "feedFile": EXE,
    }

    print(
        run(
            c,
            f"""set -e
cp -f {REMOTE_TMP} {DOWNLOAD}/{EXE}
cp -f {REMOTE_TMP} {DOWNLOAD}/Beam-Agent-Setup.exe
cp -f {REMOTE_TMP} {UPDATES}/{EXE}
cp -f {REMOTE_TMP} {UPDATES}/Beam-Agent-Setup.exe
ls -la {DOWNLOAD}/{EXE} {UPDATES}/{EXE}
""",
            timeout=300,
        ),
        flush=True,
    )

    put_text(sftp, f"{DOWNLOAD}/nightly.yml", feed)
    put_text(sftp, f"{DOWNLOAD}/latest.yml", feed)
    put_text(sftp, f"{UPDATES}/manifest.json", json.dumps(manifest, indent=2) + "\n")

    if HTML.is_file():
        html = HTML.read_text(encoding="utf-8")
        # force 0.1.5 visible strings
        html = html.replace("0.1.4", VERSION).replace("0.1.3-early-alpha", VERSION)
        html = html.replace("EARLY ALPHA · Windows · 0.1.3", f"EARLY ALPHA · Windows · {VERSION}")
        html = html.replace(">0.1.3<", f">{VERSION}<")
        put_text(sftp, f"{DOWNLOAD}/index.html", html)

    body = {
        "version": VERSION,
        "notes": notes,
        "channel": "nightly",
        "packagePath": f"{DOWNLOAD}/{EXE}",
        "file": EXE,
    }
    put_text(sftp, "/tmp/beam-publish-015.json", json.dumps(body))
    print(
        "publish-api:",
        run(
            c,
            "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
            "-H 'Content-Type: application/json' "
            f"-H 'X-Beam-Update-Token: {TOKEN}' "
            "--data-binary @/tmp/beam-publish-015.json",
            timeout=180,
        )[:1000],
        flush=True,
    )

    for url in (
        "https://agent.assistix.org/download/nightly.yml",
        "https://agent.assistix.org/download/latest.yml",
        "https://agent.assistix.org/api/check-update.php?current=0.1.3",
        "https://agent.assistix.org/api/check-update.php?current=0.1.4",
        "https://agent.assistix.org/updates/manifest.json",
    ):
        print("---", url, flush=True)
        print(run(c, f"curl -sS {url!r} | head -c 700"), flush=True)

    print("--- download page snippets", flush=True)
    print(
        run(
            c,
            "curl -sS 'https://agent.assistix.org/download/' | tr -d '\\r' | grep -E '0\\.1\\.|Setup\\.exe|verLine|badge' | head -30",
        ),
        flush=True,
    )
    print(
        run(
            c,
            f"curl -sSI 'https://agent.assistix.org/download/{EXE}' | tr -d '\\r' | sed -n '1,15p'",
        ),
        flush=True,
    )
    print("SHIPPED", VERSION, flush=True)


def main() -> int:
    if not LOCAL.is_file():
        print("missing", LOCAL)
        return 1
    size = LOCAL.stat().st_size
    if size != EXPECTED:
        print("WARN local size", size, "expected", EXPECTED)
    digest = sha512_b64(LOCAL)
    digest256 = sha256_hex(LOCAL)
    print("local", size, digest[:28], flush=True)

    # Upload with reconnect loop
    attempts = 0
    while True:
        attempts += 1
        c = sftp = None
        try:
            c, sftp = connect()
            # deploy APIs
            api = ROOT / "desktop" / "_admin_remote" / "api"
            for name in ("check-update.php", "publish-update.php"):
                p = api / name
                if p.is_file():
                    sftp.put(str(p), f"{API}/{name}")
            put_resume(sftp, LOCAL, REMOTE_TMP, size)
            activate(c, sftp, size, digest, digest256)
            sftp.close()
            c.close()
            return 0
        except Exception as e:
            print(f"attempt {attempts} failed: {e}", flush=True)
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
            if attempts >= 8:
                return 2
            time.sleep(3 + attempts)


if __name__ == "__main__":
    raise SystemExit(main())
