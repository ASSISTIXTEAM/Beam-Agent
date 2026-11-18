#!/usr/bin/env python3
"""Pull live agent.assistix.org into cloud/live for the cloud Beam Agent build."""
from __future__ import annotations

import os
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/agent.assistix.org"
LOCAL = Path(__file__).resolve().parent / "live"

FILES = [
    "index.html",
    "index.php",
    ".htaccess",
    "config.example.php",
    "auth/login.php",
    "auth/callback.php",
    "api/_boot.php",
    "api/bootstrap.php",
    "api/chat.php",
    "api/stream.php",
    "api/workspace.php",
    "api/profile.php",
    "api/logout.php",
    "api/upload.php",
    "api/file.php",
    "lib/guest.php",
    "lib/oauth.php",
    "lib/session.php",
    "lib/config.php",
    "lib/models.php",
    "lib/usage.php",
    "lib/users.php",
    "lib/brand.php",
    "lib/agent.php",
    "lib/agent_tools.php",
    "lib/agent_sandbox.php",
    "lib/agent_runs.php",
    "lib/ai.php",
    "lib/ai_tools.php",
    "lib/db.php",
    "lib/economy.php",
    "assets/chat.js",
    "assets/chat.css",
    "assets/acx.css",
    "assets/acx-core.js",
    "assets/i18n.js",
    "assets/app.js",
    "assets/agent-workspace.js",
    "assets/agent-workspace.css",
    "assets/agent-trace.css",
    "assets/style.css",
]


def main() -> None:
    LOCAL.mkdir(parents=True, exist_ok=True)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username=USER,
        password=PASS,
        timeout=45,
        banner_timeout=60,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = c.open_sftp()
    for rel in FILES:
        remote = f"{REMOTE}/{rel}"
        dest = LOCAL / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            sftp.get(remote, str(dest))
            print("ok", rel, dest.stat().st_size)
        except Exception as e:
            print("FAIL", rel, e)
    sftp.close()
    c.close()


if __name__ == "__main__":
    main()
