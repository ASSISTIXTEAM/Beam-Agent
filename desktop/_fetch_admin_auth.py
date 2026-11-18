#!/usr/bin/env python3
import os
from pathlib import Path
import paramiko

OUT = Path(__file__).resolve().parent / "_admin_remote"
OUT.mkdir(exist_ok=True)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=20)
sftp = c.open_sftp()
base = "/var/www/u3354161/data/www/assistix.org"
for name in ("admin/login.php", "db.php"):
    try:
        sftp.get(f"{base}/{name}", str(OUT / Path(name).name))
        print("got", name)
    except Exception as e:
        print("fail", name, e)
# list tables hint
stdin, stdout, stderr = c.exec_command(
    "php -r \"$c=@include '/var/www/u3354161/data/www/assistix.org/db.php'; if(!isset($pdo)){echo 'no pdo'; exit;} foreach($pdo->query('SHOW TABLES') as $r){echo array_values($r)[0].PHP_EOL;}\""
)
print("---TABLES---")
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace")[:500])
sftp.close()
c.close()
