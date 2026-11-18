#!/usr/bin/env python3
"""Deeper chat DB probe via uploaded PHP scripts."""
from __future__ import annotations

import os
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")

PHP_CHAT = r"""<?php
require '/var/www/u3354161/data/www/chat.assistix.org/lib/db.php';
$pdo = acx_db();
echo "DB=" . $pdo->query('SELECT DATABASE()')->fetchColumn() . "\n";
foreach ($pdo->query('SHOW TABLES') as $r) {
  $t = array_values($r)[0];
  try { $c = (int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn(); }
  catch (Throwable $e) { $c = -1; }
  echo "$t\t$c\n";
}
echo "=== recent users ===\n";
foreach ($pdo->query('SELECT id,email,display_name,subscription_tier,last_login_at,created_at FROM users ORDER BY id DESC LIMIT 10') as $u) {
  echo json_encode($u, JSON_UNESCAPED_UNICODE), "\n";
}
echo "=== recent conversations ===\n";
foreach ($pdo->query('SELECT id,user_id,title,model,updated_at FROM conversations ORDER BY updated_at DESC LIMIT 8') as $u) {
  echo json_encode($u, JSON_UNESCAPED_UNICODE), "\n";
}
echo "=== message sample ===\n";
foreach ($pdo->query('SELECT id,conversation_id,role,LEFT(content,80) AS content,created_at FROM messages ORDER BY id DESC LIMIT 5') as $u) {
  echo json_encode($u, JSON_UNESCAPED_UNICODE), "\n";
}
echo "=== describe users ===\n";
foreach ($pdo->query('DESCRIBE users') as $c) echo $c['Field'], "\t", $c['Type'], "\n";
echo "=== describe conversations ===\n";
foreach ($pdo->query('DESCRIBE conversations') as $c) echo $c['Field'], "\t", $c['Type'], "\n";
echo "=== describe messages ===\n";
foreach ($pdo->query('DESCRIBE messages') as $c) echo $c['Field'], "\t", $c['Type'], "\n";
"""

PHP_CFG = r"""<?php
$c = require '/var/www/u3354161/data/www/chat.assistix.org/config.local.php';
$db = $c['db'] ?? [];
echo "host=", $db['host'] ?? '', "\n";
echo "port=", $db['port'] ?? '', "\n";
echo "name=", $db['name'] ?? '', "\n";
echo "user=", $db['user'] ?? '', "\n";
echo "pass_len=", strlen((string)($db['pass'] ?? '')), "\n";
echo "charset=", $db['charset'] ?? '', "\n";
echo "keys=", implode(',', array_keys($c)), "\n";
"""

PHP_SCHEMA = r"""<?php
echo file_get_contents('/var/www/u3354161/data/www/chat.assistix.org/setup_schema.sql');
"""

PHP_API_LOG = r"""<?php
// Look for request/API logging tables or files
$root = '/var/www/u3354161/data/www/chat.assistix.org';
echo "=== grep api_log / request_log in lib ===\n";
passthru("grep -Rni --include='*.php' -E 'api_log|request_log|system_log|INSERT INTO.*(log|request|usage)' $root/lib $root/api 2>/dev/null | head -60");
echo "\n=== tables like %log% ===\n";
require "$root/lib/db.php";
$pdo = acx_db();
foreach ($pdo->query('SHOW TABLES') as $r) {
  $t = array_values($r)[0];
  if (preg_match('/log|request|report|session|audit|action/i', $t)) echo "MATCH $t\n";
}
"""

PHP_OLD = r"""<?php
require '/var/www/u3354161/data/www/assistix.org/db.php';
echo "DB=", $pdo->query('SELECT DATABASE()')->fetchColumn(), "\n";
echo "=== sample old users ===\n";
foreach ($pdo->query('SELECT id,email,created_at FROM users ORDER BY id DESC LIMIT 5') as $u) {
  echo json_encode($u, JSON_UNESCAPED_UNICODE), "\n";
}
"""

PHP_503 = r"""<?php
echo "=== index.php ===\n";
echo file_get_contents('/var/www/u3354161/data/www/chat.assistix.org/index.php');
echo "\n=== .htaccess ===\n";
echo file_get_contents('/var/www/u3354161/data/www/chat.assistix.org/.htaccess');
echo "\n=== why 503? grep maintenance ===\n";
passthru("grep -Rni --include='*.php' --include='*.html' -E '503|maintenance|Service Unavailable' /var/www/u3354161/data/www/chat.assistix.org 2>/dev/null | head -30");
"""


def put_and_run(c, sftp, name: str, code: str) -> None:
    remote = f"/tmp/{name}"
    with sftp.file(remote, "w") as f:
        f.write(code)
    print("=" * 60, name)
    stdin, stdout, stderr = c.exec_command(f"php {remote}; rm -f {remote}", timeout=120)
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("STDERR:", err[:1500])


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    sftp = c.open_sftp()
    put_and_run(c, sftp, "beam_chat_cfg.php", PHP_CFG)
    put_and_run(c, sftp, "beam_chat_db.php", PHP_CHAT)
    put_and_run(c, sftp, "beam_chat_api_log.php", PHP_API_LOG)
    put_and_run(c, sftp, "beam_old_db.php", PHP_OLD)
    put_and_run(c, sftp, "beam_chat_503.php", PHP_503)
    # schema tail
    put_and_run(c, sftp, "beam_chat_schema.php", PHP_SCHEMA)
    sftp.close()
    c.close()


if __name__ == "__main__":
    main()
