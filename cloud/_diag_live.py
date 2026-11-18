#!/usr/bin/env python3
import os
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/agent.assistix.org"

cmds = [
    f"head -40 {REMOTE}/index.php",
    f"php -l {REMOTE}/index.php",
    f"ls -la {REMOTE}/lib/rollout-gate.php {REMOTE}/index.html",
    f"grep -n '503\\|Service\\|http_response' {REMOTE}/lib/rollout-gate.php | head -40",
    f"curl -sI http://127.0.0.1/ 2>/dev/null | head -5; curl -sI https://agent.assistix.org/ | head -25",
    f"curl -s https://agent.assistix.org/ | head -50",
    f"tail -30 {REMOTE}/../logs/error.log 2>/dev/null; tail -30 ~/logs/agent.assistix.org-error.log 2>/dev/null; ls ~/logs 2>/dev/null | head",
]


def main() -> None:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=45, allow_agent=False, look_for_keys=False)
    for cmd in cmds:
        print("===", cmd[:100])
        _, o, e = c.exec_command(cmd, timeout=60)
        print(o.read().decode("utf-8", "replace")[:3000])
        err = e.read().decode("utf-8", "replace")[:800]
        if err.strip():
            print("ERR", err)
    c.close()


if __name__ == "__main__":
    main()
