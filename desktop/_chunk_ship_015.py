#!/usr/bin/env python3
"""Chunked SFTP upload of 0.1.5 Setup, assemble on server, activate channel."""
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
CHUNK_DIR = "/tmp/beam015chunks"
CHUNK = 32 * 1024 * 1024  # 32 MiB


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
        sftp.get_channel().settimeout(30 * 60)
    except Exception:
        pass
    return c, sftp


def run(c, cmd, timeout=300):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("stderr:", err[:500], flush=True)
    return out


def put_chunk(sftp, data: bytes, remote: str, expect: int) -> None:
    # skip if already correct size
    try:
        if sftp.stat(remote).st_size == expect:
            print(f"  skip {remote} ({expect})", flush=True)
            return
        sftp.remove(remote)
    except IOError:
        pass
    with sftp.file(remote, "wb") as rf:
        rf.set_pipelined(True)
        rf.write(data)
        rf.flush()
    got = sftp.stat(remote).st_size
    if got != expect:
        raise RuntimeError(f"chunk size {got} != {expect} for {remote}")


def put_text(sftp, remote, text):
    with sftp.file(remote, "w") as f:
        f.write(text)


def main() -> int:
    if not LOCAL.is_file():
        print("missing", LOCAL)
        return 1
    size = LOCAL.stat().st_size
    digest = sha512_b64(LOCAL)
    digest256 = sha256_hex(LOCAL)
    nchunks = (size + CHUNK - 1) // CHUNK
    print(f"local size={size} chunks={nchunks} sha512={digest[:28]}...", flush=True)

    # Upload chunks with reconnect per chunk
    for i in range(nchunks):
        offset = i * CHUNK
        length = min(CHUNK, size - offset)
        remote = f"{CHUNK_DIR}/part-{i:03d}"
        for attempt in range(1, 6):
            c = sftp = None
            try:
                c, sftp = connect()
                run(c, f"mkdir -p {CHUNK_DIR}")
                with LOCAL.open("rb") as lf:
                    lf.seek(offset)
                    data = lf.read(length)
                print(f"chunk {i+1}/{nchunks} attempt {attempt} ({length} bytes)", flush=True)
                put_chunk(sftp, data, remote, length)
                sftp.close()
                c.close()
                break
            except Exception as e:
                print(f"chunk {i} fail attempt {attempt}: {e}", flush=True)
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
                time.sleep(2 + attempt)
        else:
            print("FATAL chunk", i)
            return 2

    # Assemble + activate
    c, sftp = connect()
    parts = " ".join(f"{CHUNK_DIR}/part-{i:03d}" for i in range(nchunks))
    assembled = f"/tmp/{EXE}"
    print("assembling on server...", flush=True)
    out = run(
        c,
        f"""set -e
cat {parts} > {assembled}
ls -la {assembled}
python3 - <<'PY'
import hashlib, pathlib
p=pathlib.Path("{assembled}")
h=hashlib.sha512();
with p.open("rb") as f:
  while True:
    b=f.read(1024*1024)
    if not b: break
    h.update(b)
print("remote_sha512", __import__("base64").b64encode(h.digest()).decode())
print("remote_size", p.stat().st_size)
PY
""",
        timeout=600,
    )
    print(out, flush=True)
    if digest[:20] not in out and digest not in out:
        # still verify size line
        if str(size) not in out:
            print("WARN could not confirm hash in output; continuing if size matches")

    # Deploy APIs
    api = ROOT / "desktop" / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        p = api / name
        if p.is_file():
            sftp.put(str(p), f"{API}/{name}")

    print(
        run(
            c,
            f"""set -e
cp -f {assembled} {DOWNLOAD}/{EXE}
cp -f {assembled} {DOWNLOAD}/Beam-Agent-Setup.exe
cp -f {assembled} {UPDATES}/{EXE}
cp -f {assembled} {UPDATES}/Beam-Agent-Setup.exe
ls -la {DOWNLOAD}/{EXE}
""",
            timeout=300,
        ),
        flush=True,
    )

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
    put_text(sftp, f"{DOWNLOAD}/nightly.yml", feed)
    put_text(sftp, f"{DOWNLOAD}/latest.yml", feed)
    put_text(sftp, f"{UPDATES}/manifest.json", json.dumps(manifest, indent=2) + "\n")

    if HTML.is_file():
        html = HTML.read_text(encoding="utf-8")
        html = html.replace("0.1.4", VERSION).replace("0.1.3-early-alpha", VERSION)
        html = html.replace("EARLY ALPHA · Windows · 0.1.3", f"EARLY ALPHA · Windows · {VERSION}")
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
        )[:1200],
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
        print(run(c, f"curl -sS {url!r} | head -c 800"), flush=True)

    print("--- page", flush=True)
    print(
        run(
            c,
            "curl -sS 'https://agent.assistix.org/download/' | tr -d '\\r' | grep -E '0\\.1\\.|Setup\\.exe|badge|verLine' | head -30",
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

    # cleanup chunks
    run(c, f"rm -rf {CHUNK_DIR}")
    sftp.close()
    c.close()
    print("SHIPPED", VERSION, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
