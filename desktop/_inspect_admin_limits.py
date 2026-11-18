#!/usr/bin/env python3
import os
from pathlib import Path

import paramiko

PASS = os.environ.get("BP") or Path(__file__).resolve().parents[1].joinpath("secrets.local.env").read_text(encoding="utf-8").split("BP=")[1].splitlines()[0].strip()

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=40)

cmds = [
    "ls -la /var/www/u3354161/data/www/assistix.org/admin/ | head -80",
    "ls -la /var/www/u3354161/data/www/assistix.org/admin/assets/",
    "wc -c /var/www/u3354161/data/www/assistix.org/admin/index.php /var/www/u3354161/data/www/assistix.org/admin/api.php /var/www/u3354161/data/www/assistix.org/admin/login.php",
    "grep -nE 'quota|limit|beam|Tide|Flare|Pine|limits' /var/www/u3354161/data/www/assistix.org/admin/index.php | head -50",
    "grep -nE 'quota|limit|beam|Tide|Flare|Pine|limits' /var/www/u3354161/data/www/assistix.org/admin/api.php | head -60",
    "head -n 120 /var/www/u3354161/data/www/assistix.org/admin/index.php",
    "ls /var/www/u3354161/data/www/assistix.org/ | head -40",
    "php -r \"require '/var/www/u3354161/data/www/assistix.org/db.php'; echo 'db ok\\n';\"",
]
for cmd in cmds:
    print("==", cmd[:100])
    _, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    print(out[:4000])
    if err.strip():
        print("ERR", err[:800])
c.close()
