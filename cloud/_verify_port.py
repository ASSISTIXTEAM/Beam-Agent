#!/usr/bin/env python3
"""Verify Beam cloud port behind invite gate if possible."""
from __future__ import annotations

import os
import re
import http.cookiejar
import urllib.request
import ssl

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/agent.assistix.org"


def ssh_grep() -> str:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=45, allow_agent=False, look_for_keys=False)
    cmd = (
        f"sed -n '1,120p' {REMOTE}/lib/rollout-gate.php; "
        f"echo '----'; "
        f"grep -n 'function rollout_' {REMOTE}/lib/rollout-gate.php; "
        f"grep -n 'beta\\|cookie\\|secret\\|codes' {REMOTE}/config.local.php 2>/dev/null | head -40; "
        f"grep -rn 'beta_codes\\|rollout' {REMOTE}/lib/config.php 2>/dev/null | head -20"
    )
    _, o, e = c.exec_command(cmd, timeout=60)
    out = o.read().decode("utf-8", "replace")
    c.close()
    return out


def main() -> None:
    print(ssh_grep()[:6000])
    # Static assets always public
    ctx = ssl.create_default_context()
    for u in [
        "https://agent.assistix.org/assets/beam-app.js",
        "https://agent.assistix.org/assets/beam-app.css",
        "https://agent.assistix.org/assets/beam/mark.svg",
    ]:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "v"}), context=ctx, timeout=30) as r:
            print("OK", r.status, u, r.headers.get("Content-Length"))


if __name__ == "__main__":
    main()
