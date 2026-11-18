#!/usr/bin/env python3
"""Ship Beam-Agent-0.1.5-Setup.exe as sole latest on agent.assistix.org (download + updates)."""
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
PASS = os.environ.get("BP") or os.environ.get("ASSISTIX_SSH_PASS") or "mBvnX4CGq1w74JRF"
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


def connect() -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    last = None
    for i in range(1, 8):
        try:
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
            print(f"ssh ok attempt={i}", flush=True)
            return c, sftp
        except Exception as e:
            last = e
            print(f"ssh fail attempt={i}: {e}", flush=True)
            time.sleep(2 + i)
    raise RuntimeError(f"ssh failed: {last}")


def put_resumable(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    total = local.stat().st_size
    offset = 0
    try:
        st = sftp.stat(remote)
        if st.st_size == total:
            print(f"already complete {remote} ({total})", flush=True)
            return
        if 0 < st.st_size < total:
            offset = st.st_size
            print(f"resume {remote} from {offset}", flush=True)
        else:
            try:
                sftp.remove(remote)
            except OSError:
                pass
            offset = 0
    except IOError:
        offset = 0

    print(f"upload {local.name} → {remote} size={total} offset={offset}", flush=True)
    with local.open("rb") as lf, sftp.file(remote, "ab" if offset else "wb") as rf:
        if offset:
            lf.seek(offset)
        rf.set_pipelined(True)
        sent = offset
        last_pct = -1
        while True:
            chunk = lf.read(1024 * 1024)
            if not chunk:
                break
            rf.write(chunk)
            sent += len(chunk)
            pct = int(sent * 100 / total)
            if pct != last_pct and (pct % 2 == 0 or sent == total):
                last_pct = pct
                print(
                    f"  {sent / (1024 * 1024):.1f}/{total / (1024 * 1024):.1f} MB ({pct}%)",
                    flush=True,
                )
        rf.flush()
    st = sftp.stat(remote)
    if st.st_size != total:
        raise RuntimeError(f"size mismatch remote={st.st_size} local={total}")
    print("upload complete", flush=True)


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 120) -> str:
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("stderr:", err[:500], flush=True)
    return out


def put_text(sftp: paramiko.SFTPClient, remote: str, text: str) -> None:
    with sftp.file(remote, "w") as f:
        f.write(text)


def main() -> int:
    if not LOCAL.is_file():
        print("missing", LOCAL, file=sys.stderr)
        return 1

    size = LOCAL.stat().st_size
    digest = sha512_b64(LOCAL)
    digest256 = sha256_hex(LOCAL)
    release = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("local", VERSION, size, digest[:24] + "...", flush=True)

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
    notes = (
        "0.1.5: fix Desktop Host ready timeout (boot waits host+auth only), "
        "soft runtime version drift, splash/boot caps, bridge :17865, stability tray."
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

    c, sftp = connect()

    for d in (DOWNLOAD, UPDATES, API):
        try:
            sftp.stat(d)
        except IOError:
            sftp.mkdir(d)

    # Deploy API endpoints (token fallback YOUR_UPDATE_TOKEN_HERE)
    api_dir = ROOT / "desktop" / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        local = api_dir / name
        if local.is_file():
            sftp.put(str(local), f"{API}/{name}")
            print("api", name, flush=True)

    # One binary upload, then server-side copies
    put_resumable(sftp, LOCAL, REMOTE_TMP)
    cmds = f"""
set -e
cp -f {REMOTE_TMP} {DOWNLOAD}/{EXE}
cp -f {REMOTE_TMP} {DOWNLOAD}/Beam-Agent-Setup.exe
cp -f {REMOTE_TMP} {UPDATES}/{EXE}
cp -f {REMOTE_TMP} {UPDATES}/Beam-Agent-Setup.exe
ls -la {DOWNLOAD}/{EXE} {UPDATES}/{EXE}
"""
    print(run(c, cmds, timeout=300), flush=True)

    put_text(sftp, f"{DOWNLOAD}/nightly.yml", feed)
    put_text(sftp, f"{DOWNLOAD}/latest.yml", feed)
    put_text(sftp, f"{UPDATES}/manifest.json", json.dumps(manifest, indent=2) + "\n")
    print("feeds+manifest written", flush=True)

    if HTML.is_file():
        html = HTML.read_text(encoding="utf-8")
        html = (
            html.replace("0.1.4", VERSION)
            .replace("0.1.3-early-alpha", VERSION)
            .replace("0.1.3", VERSION)
            .replace("Beam-Agent-0.1.5-Setup.exe", EXE)
        )
        # keep badge/ver as 0.1.5
        put_text(sftp, f"{DOWNLOAD}/index.html", html)
        print("index.html written", flush=True)

    # Activate via publish API using already-remote package
    body = {
        "version": VERSION,
        "notes": notes,
        "channel": "nightly",
        "packagePath": f"{DOWNLOAD}/{EXE}",
        "file": EXE,
    }
    put_text(sftp, "/tmp/beam-publish-015.json", json.dumps(body))
    out = run(
        c,
        "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        "-H 'Content-Type: application/json' "
        f"-H 'X-Beam-Update-Token: {TOKEN}' "
        "--data-binary @/tmp/beam-publish-015.json",
        timeout=180,
    )
    print("publish-api:", out[:1000], flush=True)

    # Live verify from server
    for url in (
        "https://agent.assistix.org/download/nightly.yml",
        "https://agent.assistix.org/download/latest.yml",
        "https://agent.assistix.org/api/check-update.php?current=0.1.3",
        "https://agent.assistix.org/api/check-update.php?current=0.1.4",
        "https://agent.assistix.org/updates/manifest.json",
    ):
        print("---", url, flush=True)
        print(run(c, f"curl -sS {url!r} | head -c 600"), flush=True)

    # HEAD exe
    print("--- HEAD download exe", flush=True)
    print(
        run(
            c,
            f"curl -sSI 'https://agent.assistix.org/download/{EXE}' | tr -d '\\r' | sed -n '1,12p'",
        ),
        flush=True,
    )
    print(
        run(
            c,
            "curl -sS 'https://agent.assistix.org/download/' | tr -d '\\r' | grep -E '0\\.1\\.|Setup\\.exe|verLine|badge' | head -20",
        ),
        flush=True,
    )

    sftp.close()
    c.close()
    print("SHIPPED", VERSION, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
