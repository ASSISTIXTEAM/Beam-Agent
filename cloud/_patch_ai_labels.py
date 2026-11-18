#!/usr/bin/env python3
"""Patch live ai.php model display labels for Tide/Flare/Pine."""
from __future__ import annotations

import os
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
REMOTE = "/var/www/u3354161/data/www/agent.assistix.org/lib/ai.php"
LOCAL = Path(__file__).resolve().parent / "ship" / "lib" / "ai.php"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=45, banner_timeout=60, allow_agent=False, look_for_keys=False)
sftp = c.open_sftp()
sftp.get(REMOTE, str(LOCAL))
text = LOCAL.read_text(encoding="utf-8")

old = """        'FLAIR' => 'FLAIR',
        'PINE' => 'PINE',
"""
# Find the small label map used near acx_model_public_name-like helpers
needle = """    return match ($key) {
        'FLAIR' => 'FLAIR',
        'PINE' => 'PINE',
"""
# There may be multiple; patch the compact label matcher if present
count = text.count("'FLAIR' => 'FLAIR'")
print("flair label occurrences", count)

# Broader safe replacements for identity map keys
replacements = [
    ("'FLAIR' => 'FLAIR',", "'TIDE' => 'Tide',\n        'FLARE' => 'Flare',\n        'FLAIR' => 'Flare',"),
    ("default => 'FLAIR',", "default => 'Tide',"),
    ("string $modelKey = 'FLAIR'", "string $modelKey = 'TIDE'"),
]
for a, b in replacements:
    if a in text:
        text = text.replace(a, b)
        print("patched", a[:40])

LOCAL.write_text(text, encoding="utf-8")
sftp.put(str(LOCAL), REMOTE)
print("uploaded ai.php", LOCAL.stat().st_size)
_, o, e = c.exec_command(f"php -l {REMOTE}", timeout=30)
print(o.read().decode())
print(e.read().decode()[:500])
sftp.close()
c.close()
