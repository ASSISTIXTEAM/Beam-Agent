#!/usr/bin/env python3
"""Deploy ASSISTIX Control admin v2 to assistix.org/admin."""
from __future__ import annotations

import os
import time
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/assistix.org/admin"
LOCAL = Path(__file__).resolve().parent / "_admin_v2"
BACKUP = f"/var/www/u3354161/data/www/assistix.org/_admin_backup_{time.strftime('%Y%m%d_%H%M%S')}"

FILES = [
    "credentials.php",
    "auth_check.php",
    "login.php",
    "logout.php",
    "index.php",
    "api.php",
    "chat_db.php",
    ".htaccess",
    "assets/admin.css",
    "assets/admin.js",
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
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    # backup old admin (copy, keep ingest)
    stdin, stdout, stderr = c.exec_command(
        f"mkdir -p {BACKUP} && cp -a {REMOTE}/. {BACKUP}/ && echo BACKED_UP"
    )
    print(stdout.read().decode(), stderr.read().decode()[:200])

    sftp = c.open_sftp()
    ensure_dir(sftp, REMOTE + "/assets")
    ensure_dir(sftp, REMOTE + "/api")
    for rel in FILES:
        local = LOCAL / rel
        remote = f"{REMOTE}/{rel}"
        ensure_dir(sftp, str(Path(remote).parent).replace("\\", "/"))
        sftp.put(str(local), remote)
        print("put", rel)

    # Keep existing beam-ingest/quota if present; also ensure from local copy
    api_src = Path(__file__).resolve().parent / "_admin_remote" / "api"
    for name in ("beam-ingest.php", "beam-quota.php"):
        src = api_src / name
        if src.exists():
            sftp.put(str(src), f"{REMOTE}/api/{name}")
            print(f"put api/{name}")
    # Mirror quota/ingest onto public assistix + agent API trees
    for base in (
        "/var/www/u3354161/data/www/assistix.org/api",
        "/var/www/u3354161/data/www/agent.assistix.org/api",
    ):
        for name in ("beam-ingest.php", "beam-quota.php"):
            src = api_src / name
            if not src.exists():
                continue
            ensure_dir(sftp, base)
            sftp.put(str(src), f"{base}/{name}")
            print("put", f"{base}/{name}")

    # Remove old purple hub pages that conflict (keep backups)
    for obsolete in (
        "index.html",
        "dashboard.php",
        "users.php",
        "chats.php",
        "reports.php",
        "logs.php",
        "security.php",
        "database.php",
        "backups.php",
        "emails.php",
        "plugins.php",
        "settings.php",
        "api-monitor.php",
        "README.md",
    ):
        try:
            sftp.remove(f"{REMOTE}/{obsolete}")
            print("rm", obsolete)
        except Exception:
            pass

    sftp.close()

    # smoke login page + api unauthorized
    for url in (
        "https://assistix.org/admin/login.php",
        "https://assistix.org/admin/",
    ):
        stdin, stdout, stderr = c.exec_command(f"curl -sS -o /tmp/a.html -w '%{{http_code}}' {url}")
        print(url, stdout.read().decode(), stderr.read().decode()[:120])

    c.close()
    print("DEPLOYED admin v2 →", REMOTE)
    print("BACKUP →", BACKUP)


if __name__ == "__main__":
    main()
