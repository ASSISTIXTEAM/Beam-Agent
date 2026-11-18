#!/usr/bin/env python3
"""Inspect chat.assistix.org DB config + schema + counts vs assistix.org."""
from __future__ import annotations

import os
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")

CMDS = [
    r"""echo === chat config.local (redacted keys) ===
php -r '
$c = include "/var/www/u3354161/data/www/chat.assistix.org/config.local.php";
if (!is_array($c)) { echo "not array\n"; var_export($c); exit; }
foreach ($c as $k=>$v) {
  if (is_array($v)) {
    echo $k, ":\n";
    foreach ($v as $kk=>$vv) {
      $hide = preg_match("/pass|secret|key|token/i", $kk);
      echo "  ", $kk, "=", ($hide ? "[redacted len=".strlen((string)$vv)."]" : (is_scalar($vv)?$vv:json_encode($vv))), "\n";
    }
  } else {
    $hide = preg_match("/pass|secret|key|token/i", $k);
    echo $k, "=", ($hide ? "[redacted]" : (is_scalar($v)?$v:json_encode($v))), "\n";
  }
}
'
""",
    r"""echo === chat lib/db.php ===
sed -n '1,120p' /var/www/u3354161/data/www/chat.assistix.org/lib/db.php
echo === chat lib/config.php ===
sed -n '1,120p' /var/www/u3354161/data/www/chat.assistix.org/lib/config.php
echo === setup_schema.sql head ===
sed -n '1,200p' /var/www/u3354161/data/www/chat.assistix.org/setup_schema.sql
""",
    r"""echo === chat API files ===
ls -la /var/www/u3354161/data/www/chat.assistix.org/api/
ls -la /var/www/u3354161/data/www/chat.assistix.org/lib/
ls -la /var/www/u3354161/data/www/chat.assistix.org/migrations/
ls -la /var/www/u3354161/data/www/chat.assistix.org/storage/ | head -40
""",
    r"""echo === chat DB tables+counts ===
php -r '
require "/var/www/u3354161/data/www/chat.assistix.org/lib/db.php";
// try common patterns
if (!isset($pdo)) {
  if (function_exists("db")) { $pdo = db(); }
  elseif (function_exists("getPDO")) { $pdo = getPDO(); }
  elseif (isset($DB)) { $pdo = $DB; }
}
if (!($pdo instanceof PDO)) { echo "no pdo\n"; exit(1); }
echo "connected\n";
foreach ($pdo->query("SHOW TABLES") as $r) {
  $t = array_values($r)[0];
  try { $c = (int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn(); } catch (Throwable $e) { $c = -1; }
  echo $t, "\t", $c, "\n";
}
'
""",
    r"""echo === assistix.org DB counts ===
php -r '
require "/var/www/u3354161/data/www/assistix.org/db.php";
foreach (["users","conversations","messages","user_reports","system_logs","sessions"] as $t) {
  try { $c=(int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn(); echo "$t\t$c\n"; }
  catch(Throwable $e){ echo "$t\tERR ".$e->getMessage()."\n"; }
}
echo "--- db name ---\n";
echo $pdo->query("SELECT DATABASE()")->fetchColumn(), "\n";
'
""",
    r"""echo === assistix.org db.php host/db (redacted) ===
php -r '
$src = file_get_contents("/var/www/u3354161/data/www/assistix.org/db.php");
if (preg_match_all("/[\\'\"]?(host|dbname|user|database|DB_[A-Z]+)[\\'\"]?\s*[=:>]+\s*[\\'\"]([^\\'\"]+)/i", $src, $m, PREG_SET_ORDER)) {
  foreach ($m as $x) echo $x[1], "=", (stripos($x[1],"pass")!==false?"[redacted]":$x[2]), "\n";
}
// also print non-secret lines
foreach (explode("\n", $src) as $line) {
  if (preg_match("/new PDO|mysql:|dbname|host=/i", $line)) {
    echo "LINE: ", preg_replace("/password=[^;\\'\"]+/i","password=[redacted]", $line), "\n";
  }
}
'
""",
    r"""echo === curl chat insecure ===
curl -k -sS -o /dev/null -w '%{http_code}\n' https://chat.assistix.org/
curl -k -sS https://chat.assistix.org/ 2>&1 | head -30
echo === logo assets on main ===
ls -la /var/www/u3354161/data/www/assistix.org/fonts/assistix-logo.svg /var/www/u3354161/data/www/assistix.org/assets/ 2>/dev/null | head -40
find /var/www/u3354161/data/www/assistix.org -maxdepth 3 -iname '*logo*' 2>/dev/null | head -30
""",
]


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    for cmd in CMDS:
        print("=" * 60)
        stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        print(out)
        if err.strip():
            print("STDERR:", err[:1200])
    c.close()


if __name__ == "__main__":
    main()
