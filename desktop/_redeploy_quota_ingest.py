#!/usr/bin/env python3
"""Deploy beam-ingest.php + beam-quota.php to all live API paths."""
from __future__ import annotations

import json
import os
from pathlib import Path

import paramiko
import urllib.request

ROOT = Path(__file__).resolve().parent
INGEST = ROOT / "_admin_remote" / "api" / "beam-ingest.php"
QUOTA = ROOT / "_admin_remote" / "api" / "beam-quota.php"
def _load_pass() -> str:
    env = os.environ.get("BP") or os.environ.get("ASSISTIX_SSH_PASS")
    if env:
        return env
    secrets = ROOT.parent / "secrets.local.env"
    if secrets.exists():
        for line in secrets.read_text(encoding="utf-8").splitlines():
            if line.startswith("BP=") or line.startswith("ASSISTIX_SSH_PASS="):
                return line.split("=", 1)[1].strip()
    return "mBvnX4CGq1w74JRF"


PASS = _load_pass()
KEY = "beam-assistix-ingest-2026-teal"

REMOTES_INGEST = [
    "/var/www/u3354161/data/www/assistix.org/admin/api/beam-ingest.php",
    "/var/www/u3354161/data/www/assistix.org/api/beam-ingest.php",
    "/var/www/u3354161/data/www/agent.assistix.org/api/beam-ingest.php",
]
REMOTES_QUOTA = [
    "/var/www/u3354161/data/www/assistix.org/admin/api/beam-quota.php",
    "/var/www/u3354161/data/www/assistix.org/api/beam-quota.php",
    "/var/www/u3354161/data/www/agent.assistix.org/api/beam-quota.php",
]


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
    c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=40)
    sftp = c.open_sftp()
    for remote in REMOTES_INGEST:
        ensure_dir(sftp, str(Path(remote).parent).replace("\\", "/"))
        sftp.put(str(INGEST), remote)
        print("put", remote)
    for remote in REMOTES_QUOTA:
        ensure_dir(sftp, str(Path(remote).parent).replace("\\", "/"))
        sftp.put(str(QUOTA), remote)
        print("put", remote)
    sftp.close()

    # Server-side smoke (quota get + dialog ingest)
    cmds = [
        (
            "quota",
            "curl -sS -X POST https://agent.assistix.org/api/beam-quota.php "
            f"-H 'Content-Type: application/json' -H 'X-Beam-Ingest-Key: {KEY}' "
            """-d '{"action":"get","email":"beam-verify@assistix.org","id_user_id":900001}'""",
        ),
        (
            "charge",
            "curl -sS -X POST https://agent.assistix.org/api/beam-quota.php "
            f"-H 'Content-Type: application/json' -H 'X-Beam-Ingest-Key: {KEY}' "
            """-d '{"action":"charge","email":"beam-verify@assistix.org","id_user_id":900001,"tier":"tide","tokens":3}'""",
        ),
        (
            "dialog",
            "curl -sS -X POST https://agent.assistix.org/api/beam-ingest.php "
            f"-H 'Content-Type: application/json' -H 'X-Beam-Ingest-Key: {KEY}' "
            """-d '{"kind":"dialog_turn","email":"beam-verify@assistix.org","user_id":900001,"session_id":"verify-sess-1","model":"tide","user_text":"hello from deploy verify","assistant_text":"hi — beam dialog store ok","tokens_in":1,"tokens_out":2,"source":"deploy-verify"}'""",
        ),
    ]
    for name, cmd in cmds:
        stdin, stdout, stderr = c.exec_command(cmd)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        print(name, "=>", out[:300], err[:120])

    c.close()

    # Local HTTP smoke against agent quota
    req = urllib.request.Request(
        "https://agent.assistix.org/api/beam-quota.php",
        data=json.dumps(
            {"action": "get", "email": "beam-verify@assistix.org", "id_user_id": 900001}
        ).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Beam-Ingest-Key": KEY,
            "User-Agent": "BeamAgent/0.1",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            print("local quota", r.status, r.read()[:240])
    except Exception as e:
        print("local quota fail", e)


if __name__ == "__main__":
    main()
