#!/usr/bin/env python3
import os
import paramiko

script = r"""<?php
require '/var/www/u3354161/data/www/assistix.org/db.php';
foreach ($pdo->query('SHOW TABLES') as $r) {
  echo array_values($r)[0], "\n";
}
"""
remote = "/tmp/beam_show_tables.php"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=20)
sftp = c.open_sftp()
with sftp.file(remote, "w") as f:
    f.write(script)
sftp.close()
stdin, stdout, stderr = c.exec_command(f"php {remote}; rm -f {remote}")
print(stdout.read().decode())
print(stderr.read().decode()[:400])
c.close()
