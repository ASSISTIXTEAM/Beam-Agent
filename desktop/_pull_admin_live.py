#!/usr/bin/env python3
import os
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parent
PASS = os.environ.get("BP")
if not PASS:
    for line in ROOT.parents[0].joinpath("secrets.local.env").read_text(encoding="utf-8").splitlines():
        if line.startswith("BP="):
            PASS = line.split("=", 1)[1].strip()
            break

out = ROOT / "_admin_remote_live"
out.mkdir(exist_ok=True)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=40)
sftp = c.open_sftp()
files = [
    ("/var/www/u3354161/data/www/assistix.org/admin/api.php", "api.php"),
    ("/var/www/u3354161/data/www/assistix.org/admin/assets/admin.js", "admin.js"),
    ("/var/www/u3354161/data/www/assistix.org/admin/assets/admin.css", "admin.css"),
    ("/var/www/u3354161/data/www/assistix.org/admin/index.php", "index.php"),
    ("/var/www/u3354161/data/www/assistix.org/admin/api/beam-quota.php", "beam-quota.php"),
]
for rem, name in files:
    dest = out / name
    sftp.get(rem, str(dest))
    print("got", name, dest.stat().st_size)
sftp.close()
c.close()
