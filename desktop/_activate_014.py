#!/usr/bin/env python3
"""Activate already-uploaded 0.1.4 package on the update channel."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "mBvnX4CGq1w74JRF")
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN", "beam-assistix-update-2026-ops")
AGENT_ROOT = "/var/www/u3354161/data/www/agent.assistix.org"
API = f"{AGENT_ROOT}/api"
VERSION = "0.1.4"
REMOTE_TMP = "/tmp/beam-update-0.1.4.exe"
NOTES = (
    "0.1.4: quota rewrite + soft-block sync, reconnect fixes, tools/icons polish, "
    "bridge update UX. Clean semver so 0.1.3 / 0.1.3-early-alpha clients see Update."
)


def main() -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    sftp = c.open_sftp()

    # Restore API with real ops fallback token
    local_api = Path(__file__).resolve().parent / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        local = local_api / name
        remote = f"{API}/{name}"
        sftp.put(str(local), remote)
        sftp.chmod(remote, 0o644)
        print("put", remote, flush=True)

    # Confirm package present
    st = sftp.stat(REMOTE_TMP)
    print("package bytes", st.st_size, flush=True)
    if int(st.st_size) < 100_000_000:
        print("package too small", file=sys.stderr)
        return 1

    body = json.dumps(
        {
            "version": VERSION,
            "notes": NOTES,
            "channel": "nightly",
            "packagePath": REMOTE_TMP,
            "file": "Beam-Agent-0.1.4-Setup.exe",
        }
    )
    body_remote = "/tmp/beam-publish-body.json"
    with sftp.file(body_remote, "w") as f:
        f.write(body)

    cmd = (
        f"curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        f"-H 'Content-Type: application/json' "
        f"-H 'X-Beam-Update-Token: {TOKEN}' "
        f"--data-binary @{body_remote}"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=180)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    print("publish:", out, flush=True)
    if err.strip():
        print(err, file=sys.stderr, flush=True)

    for q in ("0.1.3", "0.1.3-early-alpha", "0.1.4"):
        stdin, stdout, stderr = c.exec_command(
            f"curl -sS 'https://agent.assistix.org/api/check-update.php?current={q}'"
        )
        print(f"check current={q}:", stdout.read().decode("utf-8", "replace"), flush=True)

    sftp.close()
    c.close()
    try:
        data = json.loads(out)
        return 0 if data.get("ok") else 2
    except Exception:
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
