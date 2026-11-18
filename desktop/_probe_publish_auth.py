#!/usr/bin/env python3
import os
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN", "YOUR_UPDATE_TOKEN_HERE")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=40)

cmds = [
    "ls -la /tmp/beam-update-0.1.4.exe",
    "wc -c /tmp/beam-update-0.1.4.exe",
    "sed -n '1,50p' /var/www/u3354161/data/www/agent.assistix.org/api/publish-update.php",
    "grep -nE 'BEAM_UPDATE|EXPECTED|ops|hash_equals' /var/www/u3354161/data/www/agent.assistix.org/api/publish-update.php | head -n 20",
    "printenv | grep -iE 'BEAM|UPDATE|OPS' || true",
    # Try publish with default token from server curl
    (
        "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        f"-H 'Content-Type: application/json' "
        f"-H 'X-Beam-Update-Token: {TOKEN}' "
        "--data '{\"version\":\"0.0.0-probe\",\"notes\":\"probe\",\"packagePath\":\"/tmp/does-not-exist.exe\"}'"
    ),
    (
        "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php?key="
        + TOKEN
        + "' -H 'Content-Type: application/json' "
        "--data '{\"version\":\"0.0.0-probe\",\"notes\":\"probe\",\"packagePath\":\"/tmp/does-not-exist.exe\"}'"
    ),
    (
        "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        f"-H 'Content-Type: application/json' "
        f"-H 'Authorization: Bearer {TOKEN}' "
        "--data '{\"version\":\"0.0.0-probe\",\"notes\":\"probe\",\"packagePath\":\"/tmp/does-not-exist.exe\"}'"
    ),
]

for cmd in cmds:
    print("====", cmd[:160])
    stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err)

c.close()
