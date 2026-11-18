#!/usr/bin/env python3
import json
import os
from pathlib import Path
import paramiko
import urllib.request

LOCAL = Path(__file__).resolve().parent / "_admin_remote" / "api" / "beam-ingest.php"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTES = [
    "/var/www/u3354161/data/www/assistix.org/admin/api/beam-ingest.php",
    "/var/www/u3354161/data/www/assistix.org/api/beam-ingest.php",
    "/var/www/u3354161/data/www/agent.assistix.org/api/beam-ingest.php",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=30)
sftp = c.open_sftp()
for remote in REMOTES:
    parts = remote.strip("/").split("/")
    cur = ""
    for p in parts[:-1]:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except IOError:
            sftp.mkdir(cur)
    sftp.put(str(LOCAL), remote)
    print("put", remote)
sftp.close()

# server-side smoke (avoids edge WAF)
for url in (
    "https://assistix.org/admin/api/beam-ingest.php",
    "https://assistix.org/api/beam-ingest.php",
    "https://agent.assistix.org/api/beam-ingest.php",
):
    cmd = (
        "curl -sS -X POST "
        + url
        + " -H 'Content-Type: application/json' "
        + " -H 'X-Beam-Ingest-Key: beam-assistix-ingest-2026-teal' "
        + """ -d '{"kind":"feedback","subject":"smoke","message":"path ok","source":"redeploy"}'"""
    )
    stdin, stdout, stderr = c.exec_command(cmd)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    print(url, "=>", out[:200], err[:120])
c.close()

# local smoke against agent endpoint
req = urllib.request.Request(
    "https://agent.assistix.org/api/beam-ingest.php",
    data=json.dumps(
        {"kind": "feedback", "subject": "local smoke", "message": "from PC", "source": "redeploy-local"}
    ).encode(),
    headers={
        "Content-Type": "application/json",
        "X-Beam-Ingest-Key": "beam-assistix-ingest-2026-teal",
        "User-Agent": "BeamAgent/0.1",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        print("local agent ingest", r.status, r.read()[:200])
except Exception as e:
    print("local agent ingest fail", e)
