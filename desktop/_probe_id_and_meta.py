#!/usr/bin/env python3
from __future__ import annotations

import os
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")

PHP = r"""<?php
echo "=== id.assistix.org config db ===\n";
$c = @include '/var/www/u3354161/data/www/id.assistix.org/config.local.php';
if (is_array($c)) {
  $db = $c['db'] ?? [];
  echo "name=", $db['name'] ?? ($c['dbname'] ?? ''), "\n";
  echo "user=", $db['user'] ?? '', "\n";
  echo "keys=", implode(',', array_keys($c)), "\n";
}
echo "=== id db.php ===\n";
if (is_readable('/var/www/u3354161/data/www/id.assistix.org/lib/db.php')) {
  require '/var/www/u3354161/data/www/id.assistix.org/lib/db.php';
  if (function_exists('acx_db')) $pdo = acx_db();
  elseif (function_exists('id_db')) $pdo = id_db();
  elseif (isset($pdo) && $pdo instanceof PDO) {}
  else {
    // try common
    $fn = get_defined_functions()['user'];
    echo "funcs: ", implode(',', array_filter($fn, fn($x)=>str_contains($x,'db')||str_contains($x,'pdo'))), "\n";
  }
}
if (isset($pdo) && $pdo instanceof PDO) {
  echo "DB=", $pdo->query('SELECT DATABASE()')->fetchColumn(), "\n";
  foreach ($pdo->query('SHOW TABLES') as $r) {
    $t = array_values($r)[0];
    $cnt = (int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
    echo "$t\t$cnt\n";
  }
} else {
  echo "no id pdo via require\n";
  // list files
  passthru('ls -la /var/www/u3354161/data/www/id.assistix.org/lib | head -40');
}

echo "\n=== message meta_json sample ===\n";
require '/var/www/u3354161/data/www/chat.assistix.org/lib/db.php';
$cpdo = acx_db();
foreach ($cpdo->query("SELECT id, role, model, LEFT(meta_json,200) m, created_at FROM messages WHERE meta_json IS NOT NULL ORDER BY id DESC LIMIT 8") as $r) {
  echo json_encode($r, JSON_UNESCAPED_UNICODE), "\n";
}

echo "\n=== assistix.org tables for reports/logs ===\n";
require '/var/www/u3354161/data/www/assistix.org/db.php';
foreach (['user_reports','system_logs','admin_settings','login_history','security_log','sessions'] as $t) {
  try {
    $n=(int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
    echo "$t\t$n\n";
  } catch (Throwable $e) { echo "$t ERR\n"; }
}

echo "\n=== logo.svg head ===\n";
echo substr(file_get_contents('/var/www/u3354161/data/www/assistix.org/logo.svg'),0,200), "\n";
echo "chat logo.svg size=", filesize('/var/www/u3354161/data/www/chat.assistix.org/logo.svg'), "\n";
"""


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    sftp = c.open_sftp()
    remote = "/tmp/beam_id_meta.php"
    with sftp.file(remote, "w") as f:
        f.write(PHP)
    sftp.close()
    stdin, stdout, stderr = c.exec_command(f"php {remote}; rm -f {remote}", timeout=90)
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("STDERR:", err[:1500])
    c.close()


if __name__ == "__main__":
    main()
