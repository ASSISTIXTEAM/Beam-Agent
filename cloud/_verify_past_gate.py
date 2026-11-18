#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import http.cookiejar
import urllib.parse
import urllib.request
import ssl

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/agent.assistix.org"


def fetch_rollout() -> str:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=45, allow_agent=False, look_for_keys=False)
    cmd = (
        f"ls {REMOTE}/lib/rollout.php {REMOTE}/config/rollout.php 2>/dev/null; "
        f"wc -c {REMOTE}/lib/rollout.php {REMOTE}/config/rollout.php 2>/dev/null; "
        f"grep -n 'beta\\|codes\\|COOKIE\\|setcookie\\|verify' {REMOTE}/lib/rollout.php 2>/dev/null | head -50; "
        f"grep -n 'beta\\|codes\\|COOKIE\\|setcookie\\|verify' {REMOTE}/config/rollout.php 2>/dev/null | head -50"
    )
    _, o, _ = c.exec_command(cmd, timeout=60)
    out = o.read().decode("utf-8", "replace")
    # Also cat the verify function region
    cmd2 = f"python3 - <<'PY'\nimport pathlib\nfor p in ['{REMOTE}/lib/rollout.php','{REMOTE}/config/rollout.php']:\n pth=pathlib.Path(p)\n if pth.exists():\n  t=pth.read_text(encoding='utf-8',errors='replace')\n  print('FILE',p,'LEN',len(t))\n  for m in re.finditer(r'function rollout_\\w+', t):\n   print(' ', m.group(0))\n  import re\nPY"
    # simpler sed
    cmd2 = (
        f"F=''; "
        f"if [ -f {REMOTE}/lib/rollout.php ]; then F={REMOTE}/lib/rollout.php; "
        f"elif [ -f {REMOTE}/config/rollout.php ]; then F={REMOTE}/config/rollout.php; fi; "
        f"echo FILE=$F; "
        f"grep -n \"function rollout_\\|beta_codes\\|ASSISTIX_BETA\\|setcookie\" \"$F\" | head -60; "
        f"sed -n '1,220p' \"$F\""
    )
    _, o2, _ = c.exec_command(cmd2, timeout=60)
    out2 = o2.read().decode("utf-8", "replace")
    c.close()
    return out + "\n====\n" + out2


def main() -> None:
    text = fetch_rollout()
    print(text[:8000])


if __name__ == "__main__":
    main()
