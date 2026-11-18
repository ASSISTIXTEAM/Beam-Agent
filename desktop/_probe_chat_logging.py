#!/usr/bin/env python3
from __future__ import annotations

import os
import paramiko

CMDS = [
    r"""grep -Rni --include='*.php' -E 'INSERT INTO messages|api_request|request_log|acx_log|provider' /var/www/u3354161/data/www/chat.assistix.org/lib /var/www/u3354161/data/www/chat.assistix.org/api/stream.php 2>/dev/null | head -50""",
    r"""sed -n '1,80p' /var/www/u3354161/data/www/id.assistix.org/lib/session.php""",
    r"""head -c 200 /var/www/u3354161/data/www/chat.assistix.org/favicon.svg; echo; wc -c /var/www/u3354161/data/www/chat.assistix.org/logo.svg /var/www/u3354161/data/www/assistix.org/assets/logo.png /var/www/u3354161/data/www/assistix.org/favicon.png""",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=40)
for cmd in CMDS:
    print("=" * 50)
    stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("STDERR:", err[:500])
c.close()
