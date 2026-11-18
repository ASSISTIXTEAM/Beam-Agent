#!/usr/bin/env python3
"""Deploy Beam Agent cloud ship/ → agent.assistix.org (full UI replace)."""
from __future__ import annotations

import os
import time
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/agent.assistix.org"
LOCAL = Path(__file__).resolve().parent / "ship"

# Flat PHP / config files
FILES = [
    "index.html",
    "index.php",
    "api/_boot.php",
    "api/bootstrap.php",
    "api/bridge.php",
    "api/chat.php",
    "api/stream.php",
    "api/projects.php",
    "api/workspace.php",
    "api/cloud_file.php",
    "api/logout.php",
    "auth/login.php",
    "auth/callback.php",
    "auth/complete.php",
    "auth/ping.php",
    "auth/restore.php",
    "lib/session.php",
    "lib/models.php",
    "lib/oauth.php",
    "lib/projects.php",
    "lib/cloud_workspace.php",
    "lib/agent_sandbox.php",
    "lib/brand.php",
    "assets/beam-app.css",
    "assets/beam-app.js",
    "assets/beam-mark.svg",
    "assets/beam-wordmark.svg",
    "storage/sessions/.htaccess",
    "storage/login_tickets/.htaccess",
    "storage/refresh_tokens/.htaccess",
    "storage/cloud/.htaccess",
]

# Wipe obsolete chat-shell / mini-UI assets (product UI replaced)
WIPE = [
    "assets/chat.js",
    "assets/chat.css",
    "assets/app.js",
    "assets/style.css",
    "assets/acx.css",
    "assets/agent-workspace.js",
    "assets/agent-workspace.css",
    "assets/agent-trace.css",
    "assets/beam-cloud.js",
    "assets/beam-cloud.css",
    "assets/i18n.js",
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


def put_file(sftp, rel: str) -> None:
    local = LOCAL / rel
    if not local.is_file():
        print("MISSING", rel)
        return
    remote = f"{REMOTE}/{rel.replace(chr(92), '/')}"
    ensure_dir(sftp, str(Path(remote).parent).replace("\\", "/"))
    sftp.put(str(local), remote)
    print(f"put {rel} ({local.stat().st_size}B)")


def put_tree(sftp, rel_dir: str) -> int:
    root = LOCAL / rel_dir
    if not root.is_dir():
        print("MISSING_DIR", rel_dir)
        return 0
    n = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(LOCAL).as_posix()
        put_file(sftp, rel)
        n += 1
    return n


def main() -> None:
    stamp = time.strftime("%Y%m%d-%H%M%S")
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

    bak = f"bak-beam-port-{stamp}"
    wipe_cmds = " ".join(f"rm -f {REMOTE}/{p};" for p in WIPE)
    cmd = (
        f"cd {REMOTE} && "
        f"mkdir -p {bak} && "
        f"cp -a index.html index.php assets {bak}/ 2>/dev/null; "
        f"cp -a index.html index.html.bak-cloud-{stamp} && "
        f"mkdir -p storage/projects storage/sessions storage/login_tickets storage/refresh_tokens storage/cloud assets/beam && "
        f"chmod 755 storage/projects storage/cloud && "
        f"chmod 700 storage/sessions storage/login_tickets storage/refresh_tokens && "
        f"{wipe_cmds} "
        f"echo BAK_OK {bak}"
    )
    _, o, e = c.exec_command(cmd, timeout=120)
    print(o.read().decode("utf-8", "replace"))
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR", err[:1000])

    sftp = c.open_sftp()
    for rel in FILES:
        put_file(sftp, rel)
    n_beam = put_tree(sftp, "assets/beam")
    print(f"beam_assets={n_beam}")
    sftp.close()

    lint = (
        f"php -l {REMOTE}/api/bootstrap.php; "
        f"php -l {REMOTE}/api/bridge.php; "
        f"php -l {REMOTE}/lib/session.php; "
        f"php -l {REMOTE}/lib/cloud_workspace.php; "
        f"php -l {REMOTE}/lib/agent_sandbox.php; "
        f"php -l {REMOTE}/api/workspace.php; "
        f"php -l {REMOTE}/api/cloud_file.php; "
        f"php -l {REMOTE}/api/projects.php; "
        f"php -l {REMOTE}/auth/complete.php; "
        f"php -l {REMOTE}/auth/ping.php; "
        f"php -l {REMOTE}/auth/restore.php; "
        f"php -l {REMOTE}/api/_boot.php; "
        f"ls -la {REMOTE}/assets/beam-app.js {REMOTE}/assets/beam-app.css {REMOTE}/assets/beam/mark.svg 2>&1 | head -20"
    )
    _, o, e = c.exec_command(lint, timeout=90)
    print(o.read().decode("utf-8", "replace"))
    print(e.read().decode("utf-8", "replace")[:1000])
    c.close()
    print(f"DEPLOY_DONE {stamp}")


if __name__ == "__main__":
    main()
