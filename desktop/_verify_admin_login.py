#!/usr/bin/env python3
import os
import paramiko

php = r"""<?php
$creds = require '/var/www/u3354161/data/www/assistix.org/admin/credentials.php';
$user = 'beam.ops';
$pass = 'YOUR_ADMIN_PASSWORD_HERE';
echo 'user_match=' . (hash_equals($creds['username'], $user) ? '1' : '0') . PHP_EOL;
echo 'pass_ok=' . (password_verify($pass, $creds['password_hash']) ? '1' : '0') . PHP_EOL;
echo 'hash=' . $creds['password_hash'] . PHP_EOL;
"""
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=20)
sftp = c.open_sftp()
with sftp.file("/tmp/v.php", "w") as f:
    f.write(php)
sftp.close()
stdin, stdout, stderr = c.exec_command("php /tmp/v.php; rm -f /tmp/v.php")
print(stdout.read().decode())
print(stderr.read().decode())
# also curl login
cmd = (
    "curl -sS -c /tmp/ac.txt -b /tmp/ac.txt -L -o /tmp/out.html -w '%{http_code} %{url_effective}' "
    "-X POST https://assistix.org/admin/login.php "
    "-d 'username=beam.ops&password=vF%21ZH3x1A7UG3ScN6b'"
)
stdin, stdout, stderr = c.exec_command(cmd)
print("curl", stdout.read().decode(), stderr.read().decode()[:200])
stdin, stdout, stderr = c.exec_command("head -c 200 /tmp/out.html; echo; grep -o 'ASSISTIX Control\\|Неверный\\|Обзор' /tmp/out.html | head")
print(stdout.read().decode())
c.close()
