#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parent
PASS = os.environ.get("BP")
if not PASS:
    for line in ROOT.parents[0].joinpath("secrets.local.env").read_text(encoding="utf-8").splitlines():
        if line.startswith("BP="):
            PASS = line.split("=", 1)[1].strip()
            break
KEY = "beam-assistix-ingest-2026-teal"


def post(url: str, payload: dict):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-Beam-Ingest-Key": KEY, "User-Agent": "BeamVerify/1"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read().decode("utf-8", "replace")
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def main():
    # Re-put quota to admin/api and assistix/api if needed
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=40)
    sftp = c.open_sftp()
    local = str(ROOT / "_admin_remote" / "api" / "beam-quota.php")
    for remote in [
        "/var/www/u3354161/data/www/assistix.org/admin/api/beam-quota.php",
        "/var/www/u3354161/data/www/assistix.org/api/beam-quota.php",
        "/var/www/u3354161/data/www/agent.assistix.org/api/beam-quota.php",
    ]:
        sftp.put(local, remote)
        print("re-put", remote)
    # Ensure assistix.org/api exists
    stdin, stdout, stderr = c.exec_command(
        "ls -la /var/www/u3354161/data/www/assistix.org/api/beam-quota.php; "
        "head -n 5 /var/www/u3354161/data/www/assistix.org/admin/api/beam-quota.php; "
        "php -r \"$raw=file_get_contents('php://stdin');\" </dev/null; "
        "curl -sS -o /tmp/q.json -w '%{http_code}' -X POST https://assistix.org/admin/api/beam-quota.php "
        f"-H 'Content-Type: application/json' -H 'X-Beam-Ingest-Key: {KEY}' "
        "-d '{\"action\":\"get\",\"email\":\"limits-unify-verify@assistix.org\",\"id_user_id\":900777}'; "
        "echo; head -c 300 /tmp/q.json; echo"
    )
    print(stdout.read().decode("utf-8", "replace"))
    print(stderr.read().decode("utf-8", "replace")[:500])

    # Migration check: any remaining legacy default week rows?
    stdin, stdout, stderr = c.exec_command(
        "php -r '"
        "require \"/var/www/u3354161/data/www/assistix.org/db.php\";"
        "$w=(new DateTimeImmutable(\"now\", new DateTimeZone(\"UTC\")));"
        "$dow=(int)$w->format(\"N\");"
        "$ws=$w->modify(\"-\" . ($dow-1) . \" days\")->format(\"Y-m-d\");"
        "$st=$pdo->query(\"SELECT COUNT(*) c FROM beam_weekly_usage WHERE week_start='\".$ws.\"' AND (tide_limit IN (500000,1000000) OR flare_limit IN (10000,100000) OR pine_limit IN (1000,50000))\");"
        "$row=$st->fetch(PDO::FETCH_ASSOC);"
        "echo \"legacy_week_rows=\".$row[\"c\"].\" week=\".$ws.\"\\n\";"
        "$st=$pdo->query(\"SELECT id FROM beam_quota_migrations ORDER BY applied_at\");"
        "foreach($st as $r) echo \"mig=\".$r[\"id\"].\"\\n\";"
        "$st=$pdo->query(\"SELECT COUNT(*) c FROM beam_weekly_usage WHERE week_start='\".$ws.\"'\");"
        "echo \"week_rows=\".$st->fetchColumn().\"\\n\";"
        "'"
    )
    print(stdout.read().decode("utf-8", "replace"))
    print("ERR", stderr.read().decode("utf-8", "replace")[:800])
    sftp.close()
    c.close()

    for url in [
        "https://agent.assistix.org/api/beam-quota.php",
        "https://assistix.org/api/beam-quota.php",
        "https://assistix.org/admin/api/beam-quota.php",
    ]:
        status, body = post(url, {"action": "get", "email": "limits-unify-verify@assistix.org", "id_user_id": 900777})
        print(url, status, body[:220].replace("\n", " "))

    # Sync + restart bridge
    src = ROOT / "bridge" / "server.js"
    runtime = Path(r"C:\Users\Alexa\BeamAgent\bridge\server.js")
    runtime.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    print("synced bridge")
    import subprocess
    subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         "Get-NetTCPConnection -LocalPort 17865 -ErrorAction SilentlyContinue | "
         "ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; "
         "Start-Sleep -Seconds 1; "
         "if (Test-Path 'C:\\Users\\Alexa\\BeamAgent\\start-bridge-hidden.vbs') { "
         "wscript 'C:\\Users\\Alexa\\BeamAgent\\start-bridge-hidden.vbs' }"],
        timeout=60,
    )
    time.sleep(2)
    try:
        with urllib.request.urlopen("http://127.0.0.1:17865/health", timeout=5) as r:
            print("bridge health", r.read().decode()[:200])
    except Exception as e:
        print("bridge health fail", e)


if __name__ == "__main__":
    main()
