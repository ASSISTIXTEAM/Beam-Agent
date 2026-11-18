#!/usr/bin/env python3
import os
from pathlib import Path
import paramiko

php = r"""<?php
require '/var/www/u3354161/data/www/assistix.org/db.php';
foreach (['users','conversations','messages','user_reports','system_logs','sessions','security_log','login_history','user_profiles'] as $t) {
  echo "===$t===\n";
  try {
    foreach ($pdo->query("DESCRIBE `$t`") as $r) {
      echo $r['Field'], "\t", $r['Type'], "\n";
    }
  } catch (Throwable $e) {
    echo "ERR ", $e->getMessage(), "\n";
  }
}
"""
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=20)
sftp = c.open_sftp()
path = "/tmp/beam_schema.php"
with sftp.file(path, "w") as f:
    f.write(php)
sftp.close()
stdin, stdout, stderr = c.exec_command(f"php {path}; rm -f {path}")
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace")[:300])
c.close()
