#!/usr/bin/env python3
"""Publish a Beam Agent desktop Setup.exe as the sole latest release on hosting.

Usage:
  python desktop/publish-desktop-update.py path/to/Setup.exe --version 0.1.6 --notes "Fix update UI"

Env:
  BP              SSH password (optional; has project default)
  BEAM_UPDATE_TOKEN  publish API token (optional)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN", "YOUR_UPDATE_TOKEN_HERE")
AGENT_ROOT = "/var/www/u3354161/data/www/agent.assistix.org"
UPDATES = f"{AGENT_ROOT}/updates"
DOWNLOAD = f"{AGENT_ROOT}/download"
API = f"{AGENT_ROOT}/api"


def ensure_dir(sftp, path: str) -> None:
    parts = path.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except IOError:
            sftp.mkdir(cur)


def sha512_b64(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    import base64

    return base64.b64encode(h.digest()).decode("ascii")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("package", type=Path, help="Path to Beam Agent Setup.exe")
    ap.add_argument("--version", required=True)
    ap.add_argument("--notes", default="")
    ap.add_argument("--channel", default="nightly", choices=["nightly", "latest"])
    ap.add_argument("--seed-only", action="store_true", help="Seed from already-remote download file")
    args = ap.parse_args()

    pkg: Path = args.package
    if not args.seed_only and not pkg.is_file():
        print("missing package", pkg, file=sys.stderr)
        return 1

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    sftp = c.open_sftp()
    ensure_dir(sftp, UPDATES)
    ensure_dir(sftp, DOWNLOAD)
    ensure_dir(sftp, API)

    # Deploy API endpoints
    local_api = Path(__file__).resolve().parent / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        local = local_api / name
        remote = f"{API}/{name}"
        sftp.put(str(local), remote)
        sftp.chmod(remote, 0o644)
        print("put", remote)

    remote_tmp = f"/tmp/beam-update-{args.version.replace('/', '-')}.exe"
    if args.seed_only:
        # Copy existing download artifact into /tmp for activate
        src = str(pkg) if str(pkg).startswith("/") else f"{DOWNLOAD}/{pkg.name}"
        stdin, stdout, stderr = c.exec_command(f"cp -f {src!s} {remote_tmp!s} && ls -la {remote_tmp!s}")
        print(stdout.read().decode(), stderr.read().decode())
    else:
        total = pkg.stat().st_size
        print(f"uploading {pkg} ({total} bytes) → {remote_tmp}", flush=True)
        last_pct = [-1]

        def progress(transferred: int, size: int) -> None:
            if size <= 0:
                return
            pct = int(transferred * 100 / size)
            if pct != last_pct[0] and (pct % 5 == 0 or transferred == size):
                last_pct[0] = pct
                print(
                    f"  upload {transferred / (1024 * 1024):.1f}/{size / (1024 * 1024):.1f} MB ({pct}%)",
                    flush=True,
                )

        try:
            sftp.get_channel().settimeout(60 * 60)
        except Exception:
            pass
        sftp.put(str(pkg), remote_tmp, callback=progress)
        print("upload done", sha512_b64(pkg)[:24] + "...", flush=True)

    # Activate via publish-update.php using server-local packagePath
    body = json.dumps(
        {
            "version": args.version,
            "notes": args.notes,
            "channel": args.channel,
            "packagePath": remote_tmp,
            "file": pkg.name if pkg.name else "Beam-Agent-Setup.exe",
        }
    )
    # Write body to temp on server to avoid shell escaping issues
    body_remote = "/tmp/beam-publish-body.json"
    with sftp.file(body_remote, "w") as f:
        f.write(body)

    cmd = (
        f"curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        f"-H 'Content-Type: application/json' "
        f"-H 'X-Beam-Update-Token: {TOKEN}' "
        f"--data-binary @{body_remote}"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    print(out)
    if err.strip():
        print(err, file=sys.stderr)

    # Verify check-update
    stdin, stdout, stderr = c.exec_command(
        "curl -sS 'https://agent.assistix.org/api/check-update.php?current=0.0.0'"
    )
    verify = stdout.read().decode("utf-8", "replace")
    print("check-update:", verify[:500])

    sftp.close()
    c.close()

    try:
        data = json.loads(out)
        return 0 if data.get("ok") else 2
    except Exception:
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
