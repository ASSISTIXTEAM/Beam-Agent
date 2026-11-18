#!/usr/bin/env python3
import os
import re
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/agent.assistix.org"


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=45, allow_agent=False, look_for_keys=False)
    cmds = [
        f"sed -n '120,200p' {REMOTE}/lib/rollout-gate.php",
        f"grep -n 'cookie\\|COOKIE\\|beta\\|invite\\|bypass\\|ASSISTIX' {REMOTE}/lib/rollout-gate.php | head -40",
        f"head -5 {REMOTE}/index.html; grep -n 'beam-app\\|ba-shell\\|authGate' {REMOTE}/index.html | head",
        f"ls -la {REMOTE}/assets/beam-app.js {REMOTE}/assets/acx-core.js",
        # fetch index bypassing gate if possible via local php with env
        f"php -r 'var_export(function_exists(\"rollout_gate_enforce\"));'",
    ]
    for cmd in cmds:
        print("===", cmd[:110])
        _, o, e = c.exec_command(cmd, timeout=60)
        print(o.read().decode("utf-8", "replace")[:3500])
        err = e.read().decode("utf-8", "replace")[:500]
        if err.strip():
            print("ERR", err)
    c.close()


if __name__ == "__main__":
    main()
