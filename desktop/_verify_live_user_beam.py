#!/usr/bin/env python3
import json
import os
import urllib.request

import paramiko

KEY = "beam-assistix-ingest-2026-teal"
EMAIL = "alessandro_calandrini@mail.ru"
UID = 3


def post(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-Beam-Ingest-Key": KEY},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


print(
    "charge",
    post(
        "https://agent.assistix.org/api/beam-quota.php",
        {
            "action": "charge",
            "email": EMAIL,
            "id_user_id": UID,
            "tier": "tide",
            "tokens": 13,
        },
    ).get("quotas", {}).get("tide"),
)
print(
    "dialog",
    post(
        "https://agent.assistix.org/api/beam-ingest.php",
        {
            "kind": "dialog_turn",
            "email": EMAIL,
            "user_id": UID,
            "session_id": "live-alessandro-1",
            "model": "tide",
            "user_text": "Live Beam Agent test prompt",
            "assistant_text": "Live Beam Agent test reply for Admin Beam Agent tab",
            "tokens_in": 13,
            "tokens_out": 9,
            "source": "live-verify",
        },
    ),
)

with urllib.request.urlopen("http://127.0.0.1:17865/assistix/status", timeout=8) as r:
    st = json.loads(r.read().decode())
    print(
        "bridge_status",
        st.get("quotas", {}).get("tide"),
        "quotaServer",
        bool(st.get("quotaServer")),
    )

SCRIPT = r"""
rm -f /tmp/ac.jar
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar -o /dev/null https://assistix.org/admin/login.php
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar -o /dev/null -X POST https://assistix.org/admin/login.php \
  --data-urlencode username=beam.ops --data-urlencode 'password=YOUR_ADMIN_PASSWORD_HERE'
curl -sS -c /tmp/ac.jar -b /tmp/ac.jar --get 'https://assistix.org/admin/api.php' \
  --data-urlencode 'action=users' --data-urlencode 'q=alessandro_calandrini@mail.ru' \
  --data-urlencode 'limit=5' > /tmp/au.json
php -r '$j=json_decode(file_get_contents("/tmp/au.json"),true); foreach(($j["data"]["items"]??[]) as $u){echo $u["id"]," ",$u["email"]," idu=",($u["id_user_id"]??""),"\n"; file_put_contents("/tmp/aid.txt",(string)$u["id"]);}'
AID=$(cat /tmp/aid.txt 2>/dev/null || true)
echo "AID=$AID"
if [ -n "$AID" ]; then
  curl -sS -c /tmp/ac.jar -b /tmp/ac.jar "https://assistix.org/admin/api.php?action=user.get&id=$AID" > /tmp/ag.json
  php -r '$j=json_decode(file_get_contents("/tmp/ag.json"),true); $d=$j["data"]??[]; echo "beam_sessions=",count($d["beam_sessions"]??[])," beam_tide=",($d["beam_usage"]["tide_used"]??"?")," chats=",count($d["chats"]??[]),"\n"; $bs=$d["beam_sessions"][0]??null; if($bs){echo "title=",$bs["title"],"\n";}'
fi
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "31.31.196.221",
    username="u3354161",
    password=os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE"),
    timeout=40,
)
stdin, stdout, stderr = c.exec_command(SCRIPT, timeout=120)
print(stdout.read().decode(errors="replace"))
err = stderr.read().decode(errors="replace")
if err.strip():
    print("STDERR", err[:800])
c.close()
