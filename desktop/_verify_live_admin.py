#!/usr/bin/env python3
"""Login + curl live admin overview; patch users.php authed_at if needed."""
from __future__ import annotations

import os
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")

SCRIPT = r"""
python3 - <<'PY'
from pathlib import Path
import re
p = Path('/var/www/u3354161/data/www/chat.assistix.org/lib/users.php')
s = p.read_text(encoding='utf-8', errors='replace')
if "['authed_at']" in s:
    print('USERS_ALREADY')
else:
    m = re.search(r"\$_SESSION\['acx_user'\]\s*=\s*\[[\s\S]*?\];", s)
    if not m:
        print('USERS_SKIP')
    else:
        s2 = s[:m.end()] + "\n    $_SESSION['acx_user']['authed_at'] = time();" + s[m.end():]
        p.write_text(s2, encoding='utf-8')
        print('USERS_PATCHED')
PY

rm -f /tmp/ac.jar
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar -o /tmp/login.html https://assistix.org/admin/login.php >/dev/null
CODE=$(curl -sS -c /tmp/ac.jar -b /tmp/ac.jar -o /tmp/login_post.html -w '%{http_code}' \
  -X POST 'https://assistix.org/admin/login.php' \
  --data-urlencode 'username=beam.ops' \
  --data-urlencode 'password=YOUR_ADMIN_PASSWORD_HERE')
echo "login_http=$CODE"
IDX=$(curl -sS -c /tmp/ac.jar -b /tmp/ac.jar -o /tmp/idx.html -w '%{http_code}' https://assistix.org/admin/)
echo "index_http=$IDX"
grep -o 'assistix-mark.svg\|ASSISTIX Control\|Обзор\|rail-logo' /tmp/idx.html | sort -u
echo '--- overview ---'
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar 'https://assistix.org/admin/api.php?action=overview' > /tmp/ov.json
php -r '$j=json_decode(file_get_contents("/tmp/ov.json"),true); echo ($j["ok"]?"OK":"FAIL"),"\n"; $s=$j["data"]["stats"]??[]; foreach(["users","chats","msgs","apiRequests","idAccounts","reportsAll","beamReports","source"] as $k) echo $k,"=",($s[$k]??""),"\n"; echo "sample=",($j["data"]["recentUsers"][0]["email"]??""),"\n"; echo "chat=",($j["data"]["recentChats"][0]["title"]??""),"\n";'
echo '--- users ---'
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar 'https://assistix.org/admin/api.php?action=users&limit=2' > /tmp/u.json
php -r '$j=json_decode(file_get_contents("/tmp/u.json"),true); echo "total=",($j["data"]["total"]??0)," source=",($j["data"]["source"]??""),"\n"; foreach(($j["data"]["items"]??[]) as $u) echo $u["id"]," ",$u["email"]," chats=",$u["chats"],"\n";'
echo '--- logo ---'
curl -sS -o /dev/null -w 'logo:%{http_code} size:%{size_download}\n' https://assistix.org/admin/assets/assistix-mark.svg
echo '--- ingest ---'
test -f /var/www/u3354161/data/www/assistix.org/admin/api/beam-ingest.php && echo INGEST_OK
php -r 'require "/var/www/u3354161/data/www/assistix.org/admin/chat_db.php"; $p=chat_pdo(); echo "api_request_logs=",(int)$p->query("SELECT COUNT(*) FROM api_request_logs")->fetchColumn(),"\n"; echo "admin_actions=",(int)$p->query("SELECT COUNT(*) FROM admin_actions")->fetchColumn(),"\n";'
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=40)
stdin, stdout, stderr = c.exec_command(SCRIPT, timeout=120)
print(stdout.read().decode(errors="replace"))
err = stderr.read().decode(errors="replace")
if err.strip():
    print("STDERR:", err[:1200])
c.close()
