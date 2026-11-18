#!/usr/bin/env python3
import os
import paramiko

PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=30)
cmd = """
cd /var/www/u3354161/data/www/agent.assistix.org/download
rm -f Beam-Agent-Setup-0.1.0-beta.exe || true
rm -f Beam-Agent-0.1.1*.exe Beam-Agent-0.1.2*.exe || true
ls -la
echo ---
ls -la /var/www/u3354161/data/www/agent.assistix.org/updates/
"""
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace"))
c.close()
