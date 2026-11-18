#!/usr/bin/env python3
import os
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "31.31.196.221",
    username="u3354161",
    password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"),
    timeout=20,
)
cmd = r"""
ls -la /var/www/u3354161/data/www/assistix.org/admin | head -50
echo '---API---'
ls /var/www/u3354161/data/www/assistix.org/admin/api 2>/dev/null | head -50
echo '---MATCH---'
ls /var/www/u3354161/data/www/assistix.org/admin 2>/dev/null | grep -Ei 'report|feedback|log|beam|inbox' || true
echo '---REPORTS FILE---'
find /var/www/u3354161/data/www/assistix.org/admin -maxdepth 2 -iname '*report*' 2>/dev/null | head -30
"""
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace"))
c.close()
