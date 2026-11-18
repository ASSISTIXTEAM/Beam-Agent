#!/usr/bin/env python3
"""Deploy Beam ingest API into assistix.org/admin/api/."""
from __future__ import annotations

import os
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE_DIR = "/var/www/u3354161/data/www/assistix.org/admin/api"
LOCAL = Path(__file__).resolve().parent / "_admin_remote" / "api" / "beam-ingest.php"


def ensure_dir(sftp, path: str) -> None:
    parts = path.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except IOError:
            sftp.mkdir(cur)


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30)
    sftp = c.open_sftp()
    ensure_dir(sftp, REMOTE_DIR)
    remote = f"{REMOTE_DIR}/beam-ingest.php"
    sftp.put(str(LOCAL), remote)
    sftp.chmod(remote, 0o644)
    sftp.close()
    # smoke via curl on server
    stdin, stdout, stderr = c.exec_command(
        "curl -sS -X POST https://assistix.org/admin/api/beam-ingest.php "
        "-H 'Content-Type: application/json' "
        "-H 'X-Beam-Ingest-Key: beam-assistix-ingest-2026-teal' "
        "-d '{\"kind\":\"feedback\",\"subject\":\"Beam ingest smoke\",\"message\":\"deploy ok\",\"source\":\"deploy-script\"}'"
    )
    print(stdout.read().decode("utf-8", "replace"))
    print(stderr.read().decode("utf-8", "replace"))
    c.close()
    print("DEPLOYED", remote)


if __name__ == "__main__":
    main()
