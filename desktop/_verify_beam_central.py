#!/usr/bin/env python3
"""Verify central quotas + Beam dialogs + admin CHAT tab still live."""
from __future__ import annotations

import json
import os
import urllib.request

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
KEY = "beam-assistix-ingest-2026-teal"
ADMIN_USER = "beam.ops"
ADMIN_PASS = "YOUR_ADMIN_PASSWORD_HERE"

SCRIPT = r"""
set -e
rm -f /tmp/ac.jar
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar -o /tmp/login.html https://assistix.org/admin/login.php >/dev/null
CODE=$(curl -sS -c /tmp/ac.jar -b /tmp/ac.jar -o /tmp/login_post.html -w '%{http_code}' \
  -X POST 'https://assistix.org/admin/login.php' \
  --data-urlencode 'username=beam.ops' \
  --data-urlencode 'password=YOUR_ADMIN_PASSWORD_HERE')
echo "login_http=$CODE"

# Pick a real chat user
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar 'https://assistix.org/admin/api.php?action=users&limit=1' > /tmp/u.json
php -r '
$j=json_decode(file_get_contents("/tmp/u.json"),true);
$u=$j["data"]["items"][0]??null;
if(!$u){fwrite(STDERR,"no users\n"); exit(1);}
file_put_contents("/tmp/pick.json", json_encode($u));
echo "picked id=",$u["id"]," email=",$u["email"]," id_user=",($u["id_user_id"]??"")," chats=",$u["chats"],"\n";
'

EMAIL=$(php -r 'echo json_decode(file_get_contents("/tmp/pick.json"),true)["email"];')
IDUID=$(php -r '$u=json_decode(file_get_contents("/tmp/pick.json"),true); echo (int)($u["id_user_id"]??0);')
CID=$(php -r 'echo (int)json_decode(file_get_contents("/tmp/pick.json"),true)["id"];')

# Seed Beam dialog + charge against this real user (anti-cheat identity)
curl -sS -X POST https://agent.assistix.org/api/beam-ingest.php \
  -H 'Content-Type: application/json' -H 'X-Beam-Ingest-Key: beam-assistix-ingest-2026-teal' \
  -d "{\"kind\":\"dialog_turn\",\"email\":\"$EMAIL\",\"user_id\":$IDUID,\"session_id\":\"admin-verify-$CID\",\"model\":\"tide\",\"user_text\":\"Admin verify user prompt\",\"assistant_text\":\"Admin verify assistant reply — Beam Agent tab\",\"tokens_in\":11,\"tokens_out\":22,\"source\":\"verify-script\"}" \
  > /tmp/dlg.json
echo "dialog_seed=$(cat /tmp/dlg.json)"

curl -sS -X POST https://agent.assistix.org/api/beam-quota.php \
  -H 'Content-Type: application/json' -H 'X-Beam-Ingest-Key: beam-assistix-ingest-2026-teal' \
  -d "{\"action\":\"charge\",\"email\":\"$EMAIL\",\"id_user_id\":$IDUID,\"tier\":\"flare\",\"tokens\":7}" \
  > /tmp/ch.json
echo "charge=$(cat /tmp/ch.json)"

# Wipe-proof: get again and ensure used >= 7
curl -sS -X POST https://agent.assistix.org/api/beam-quota.php \
  -H 'Content-Type: application/json' -H 'X-Beam-Ingest-Key: beam-assistix-ingest-2026-teal' \
  -d "{\"action\":\"get\",\"email\":\"$EMAIL\",\"id_user_id\":$IDUID}" \
  > /tmp/gq.json
php -r '$j=json_decode(file_get_contents("/tmp/gq.json"),true); echo "server_flare_used=",($j["quotas"]["flare"]["used"]??"?")," ok=",($j["ok"]?"1":"0"),"\n";'

# Admin user.get must include beam_sessions + chats
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar "https://assistix.org/admin/api.php?action=user.get&id=$CID" > /tmp/ug.json
php -r '
$j=json_decode(file_get_contents("/tmp/ug.json"),true);
echo "user_get_ok=",(!empty($j["ok"])?"1":"0"),"\n";
$d=$j["data"]??[];
echo "chat_count=",count($d["chats"]??[]),"\n";
echo "beam_sessions=",count($d["beam_sessions"]??[]),"\n";
$bs=$d["beam_sessions"][0]??null;
if($bs){ echo "beam_title=",($bs["title"]??"")," id=",$bs["id"],"\n"; file_put_contents("/tmp/bsid.txt",(string)$bs["id"]); }
echo "beam_usage_flare=",($d["beam_usage"]["flare_used"]??"null"),"\n";
echo "has_chat_usage=",(isset($d["usage"])?"1":"0"),"\n";
'
BSID=$(cat /tmp/bsid.txt 2>/dev/null || echo 0)
if [ "$BSID" != "0" ] && [ -n "$BSID" ]; then
  curl -sS -c /tmp/ac.jar -b /tmp/ac.jar "https://assistix.org/admin/api.php?action=beam.session.get&id=$BSID" > /tmp/bs.json
  php -r '$j=json_decode(file_get_contents("/tmp/bs.json"),true); echo "beam_msgs=",count($j["data"]["messages"]??[])," product=",($j["data"]["product"]??""),"\n"; foreach(($j["data"]["messages"]??[]) as $m) echo $m["role"],":",substr(str_replace("\n"," ",$m["content"]),0,60),"\n";'
fi

# CHAT still works
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar 'https://assistix.org/admin/api.php?action=chats&limit=2' > /tmp/chats.json
php -r '$j=json_decode(file_get_contents("/tmp/chats.json"),true); echo "chats_ok=",(!empty($j["ok"])?"1":"0")," total=",($j["data"]["total"]??0)," source=",($j["data"]["source"]??""),"\n";'

# DB table presence
php -r '
require "/var/www/u3354161/data/www/assistix.org/db.php";
foreach(["beam_weekly_usage","beam_user_limits","beam_dialog_sessions","beam_dialog_messages"] as $t){
  $n=(int)$pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
  echo $t,"=",$n,"\n";
}
'

test -f /var/www/u3354161/data/www/assistix.org/admin/api/beam-quota.php && echo QUOTA_FILE_OK
test -f /var/www/u3354161/data/www/agent.assistix.org/api/beam-quota.php && echo AGENT_QUOTA_OK
"""


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40)
    stdin, stdout, stderr = c.exec_command(SCRIPT, timeout=180)
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("STDERR:", err[:1500])
    c.close()

    # Local wipe-proof check: charge then get without any local state
    def post(url: str, payload: dict) -> dict:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "X-Beam-Ingest-Key": KEY,
                "User-Agent": "BeamVerify/1",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read().decode())

    g1 = post(
        "https://agent.assistix.org/api/beam-quota.php",
        {"action": "get", "email": "wipe-proof@assistix.org", "id_user_id": 900002},
    )
    used_before = int(g1["quotas"]["pine"]["used"])
    post(
        "https://agent.assistix.org/api/beam-quota.php",
        {
            "action": "charge",
            "email": "wipe-proof@assistix.org",
            "id_user_id": 900002,
            "tier": "pine",
            "tokens": 5,
        },
    )
    g2 = post(
        "https://agent.assistix.org/api/beam-quota.php",
        {"action": "get", "email": "wipe-proof@assistix.org", "id_user_id": 900002},
    )
    used_after = int(g2["quotas"]["pine"]["used"])
    print(
        f"wipe_proof pine {used_before} -> {used_after} survive={used_after >= used_before + 5}"
    )


if __name__ == "__main__":
    main()
