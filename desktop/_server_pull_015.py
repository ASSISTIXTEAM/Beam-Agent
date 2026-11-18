#!/usr/bin/env python3
"""Ask hosting to pull Beam-Agent-0.1.5-Setup.exe from private GitHub release asset."""
from __future__ import annotations

import os
import subprocess
import sys
import time

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP") or os.environ.get("ASSISTIX_SSH_PASS") or "YOUR_SSH_PASSWORD_HERE"
DEST = "/var/www/u3354161/data/www/agent.assistix.org/download/Beam-Agent-0.1.5-Setup.exe"
PARTIAL = DEST + ".ghpartial"
LOG = "/tmp/gh015.log"


def gh_json(cmd: list[str]) -> str:
    out = subprocess.check_output(["gh", *cmd], text=True)
    return out.strip()


def main() -> int:
    asset_url = gh_json(
        [
            "api",
            "repos/ASSISTIXTEAM/Beam-Agent/releases/tags/v0.1.5",
            "--jq",
            '.assets[] | select(.name=="Beam-Agent-0.1.5-Setup.exe") | .url',
        ]
    )
    asset_size = int(
        gh_json(
            [
                "api",
                "repos/ASSISTIXTEAM/Beam-Agent/releases/tags/v0.1.5",
                "--jq",
                '.assets[] | select(.name=="Beam-Agent-0.1.5-Setup.exe") | .size',
            ]
        )
    )
    token = gh_json(["auth", "token"])
    print("asset", asset_size, asset_url[:80], flush=True)

    # remote bash script (no f-string brace hell for arrays)
    remote = f"""
set -e
echo "boot $(date -Is)" > {LOG}
nohup curl -L --fail --retry 10 --retry-delay 2 \\
  -H "Authorization: Bearer {token}" \\
  -H "Accept: application/octet-stream" \\
  -C - -o "{PARTIAL}" "{asset_url}" >> {LOG} 2>&1 &
echo $! > /tmp/gh015.pid
echo STARTED $(cat /tmp/gh015.pid)
"""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = c.exec_command(remote)
    print(stdout.read().decode(), flush=True)
    err = stderr.read().decode()
    if err.strip():
        print("stderr", err[:400], flush=True)

    # poll until size matches or timeout
    for i in range(180):
        _, stdout, _ = c.exec_command(
            f"stat -c%s {PARTIAL} 2>/dev/null || echo 0; "
            f"stat -c%s {DEST} 2>/dev/null || echo 0; "
            f"tail -3 {LOG} 2>/dev/null; "
            f"ps -p $(cat /tmp/gh015.pid 2>/dev/null) -o pid= 2>/dev/null || echo DEAD"
        )
        body = stdout.read().decode("utf-8", "replace")
        lines = body.strip().splitlines()
        partial_sz = int(lines[0]) if lines else 0
        final_sz = int(lines[1]) if len(lines) > 1 else 0
        print(f"poll {i}: partial={partial_sz} final={final_sz}", flush=True)
        print("\n".join(lines[2:]), flush=True)
        if final_sz == asset_size:
            print("ALREADY_FINAL", flush=True)
            c.close()
            return 0
        if partial_sz == asset_size:
            _, stdout, stderr = c.exec_command(f"mv -f {PARTIAL} {DEST} && ls -la {DEST}")
            print(stdout.read().decode(), flush=True)
            print(stderr.read().decode(), flush=True)
            print("PULLED_OK", flush=True)
            c.close()
            return 0
        # if curl died early and size wrong, restart once
        if "DEAD" in body and partial_sz < asset_size and i > 3 and i % 20 == 0:
            print("restart curl", flush=True)
            c.exec_command(remote)
        time.sleep(5)

    print("TIMEOUT", flush=True)
    c.close()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
