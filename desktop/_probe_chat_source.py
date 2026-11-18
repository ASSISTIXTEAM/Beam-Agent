#!/usr/bin/env python3
"""Probe where chat.assistix.org live data lives."""
from __future__ import annotations

import os
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")

CMDS = [
    r"""echo === curl chat ===
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' https://chat.assistix.org/ || true
curl -sS -I https://chat.assistix.org/ 2>&1 | head -25
curl -sS https://chat.assistix.org/ 2>&1 | head -40
""",
    r"""echo === www roots ===
ls -la /var/www/u3354161/data/www/ | head -100
""",
    r"""echo === find chat ===
find /var/www/u3354161/data/www -maxdepth 3 \( -iname '*chat*' -o -iname '*assistix*' \) 2>/dev/null | head -80
ls -la /var/www/u3354161/data/www/chat.assistix.org 2>/dev/null | head -40
ls -la /var/www/u3354161/data/www/assistix.org 2>/dev/null | head -40
""",
    r"""echo === apache/nginx configs mentioning chat ===
grep -Ril 'chat.assistix' /var/www/u3354161/data/etc 2>/dev/null | head -20
grep -Ril 'chat.assistix' /etc 2>/dev/null | head -20
ls /var/www/u3354161/data/etc 2>/dev/null
find /var/www/u3354161/data -maxdepth 4 -name '*.conf' 2>/dev/null | head -40
""",
    r"""echo === db.php files ===
find /var/www/u3354161/data/www -maxdepth 4 -name 'db.php' 2>/dev/null
find /var/www/u3354161/data/www -maxdepth 4 -name '.env' 2>/dev/null | head -40
find /var/www/u3354161/data/www -maxdepth 4 -name 'config.php' 2>/dev/null | head -40
""",
]


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    for cmd in CMDS:
        print("=" * 60)
        stdin, stdout, stderr = c.exec_command(cmd, timeout=90)
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        print(out)
        if err.strip():
            print("STDERR:", err[:800])
    c.close()


if __name__ == "__main__":
    main()
