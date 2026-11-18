#!/usr/bin/env python3
import os
from pathlib import Path
import paramiko

OUT = Path(__file__).resolve().parent / "_admin_remote"
OUT.mkdir(exist_ok=True)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "31.31.196.221",
    username="u3354161",
    password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"),
    timeout=20,
)
sftp = c.open_sftp()
base = "/var/www/u3354161/data/www/assistix.org/admin"
for name in ("reports.php", "logs.php", "README.md", "auth_check.php", "index.php"):
    remote = f"{base}/{name}"
    local = OUT / name
    sftp.get(remote, str(local))
    print("got", name, local.stat().st_size)
sftp.close()
# Also peek DB config near site root
stdin, stdout, stderr = c.exec_command(
    "grep -RniE 'report|feedback|CREATE TABLE|mysqli|PDO' /var/www/u3354161/data/www/assistix.org/admin/reports.php /var/www/u3354161/data/www/assistix.org/admin/logs.php | head -80"
)
print(stdout.read().decode("utf-8", "replace"))
c.close()
