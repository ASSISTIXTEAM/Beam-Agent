#!/usr/bin/env python3
from __future__ import annotations

import os
import paramiko

cmd = r"""grep -Rni --include='*.php' -E 'function acx_logged_user|function acx_require_user|\$_SESSION\[' /var/www/u3354161/data/www/chat.assistix.org/lib /var/www/u3354161/data/www/chat.assistix.org/auth 2>/dev/null | head -40
echo '===='
# show logged user function file
f=$(grep -Rln --include='*.php' 'function acx_logged_user' /var/www/u3354161/data/www/chat.assistix.org 2>/dev/null | head -1)
echo FILE=$f
sed -n '1,200p' "$f"
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=40)
stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
print(stdout.read().decode(errors="replace")[:12000])
print(stderr.read().decode(errors="replace")[:500])
c.close()
