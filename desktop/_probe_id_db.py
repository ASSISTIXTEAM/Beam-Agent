#!/usr/bin/env python3
from __future__ import annotations

import os
import paramiko

PHP = r"""<?php
require '/var/www/u3354161/data/www/id.assistix.org/lib/db.php';
$pdo = aid_db();
echo "DB=", $pdo->query('SELECT DATABASE()')->fetchColumn(), "\n";
foreach ($pdo->query('SHOW TABLES') as $r) {
  $t = array_values($r)[0];
  $c = (int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
  echo "$t\t$c\n";
}
echo "=== describe sessions-like ===\n";
foreach ($pdo->query('SHOW TABLES') as $r) {
  $t = array_values($r)[0];
  if (preg_match('/session|token|user|login|oauth/i', $t)) {
    echo "-- $t --\n";
    foreach ($pdo->query("DESCRIBE `$t`") as $col) echo $col['Field'], "\t", $col['Type'], "\n";
    foreach ($pdo->query("SELECT * FROM `$t` ORDER BY 1 DESC LIMIT 3") as $row) {
      // redact secrets
      foreach ($row as $k=>$v) {
        if (preg_match('/pass|secret|token|hash|code/i', (string)$k) && is_string($v) && strlen($v)>8) $row[$k]='[redacted]';
      }
      echo json_encode($row, JSON_UNESCAPED_UNICODE), "\n";
    }
  }
}
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"), timeout=40)
sftp = c.open_sftp()
with sftp.file("/tmp/beam_id_db.php", "w") as f:
    f.write(PHP)
sftp.close()
stdin, stdout, stderr = c.exec_command("php /tmp/beam_id_db.php; rm -f /tmp/beam_id_db.php", timeout=90)
print(stdout.read().decode(errors="replace"))
err = stderr.read().decode(errors="replace")
if err.strip():
    print("STDERR:", err[:1200])
c.close()
