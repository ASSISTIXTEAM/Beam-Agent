#!/usr/bin/env python3
"""Upload Beam Agent beta installer + download page to agent.assistix.org."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "YOUR_SSH_PASSWORD_HERE"
REMOTE_DIR = "/var/www/u3354161/data/www/agent.assistix.org/download"

ROOT = Path(__file__).resolve().parents[2]
LOCAL_EXE = ROOT / "dist" / "installer" / "Beam-Agent-Setup-0.1.0-beta.exe"
LOCAL_HTML = Path(__file__).resolve().parent / "download-index.html"
REMOTE_EXE = f"{REMOTE_DIR}/Beam-Agent-Setup-0.1.0-beta.exe"
REMOTE_HTML = f"{REMOTE_DIR}/index.html"
REMOTE_HTACCESS = f"{REMOTE_DIR}/.htaccess"

HTACCESS = """# Beam Agent beta downloads
Options -Indexes
<IfModule mod_headers.c>
  <FilesMatch "\\.(exe)$">
    Header set Content-Type "application/octet-stream"
    Header set Content-Disposition "attachment"
  </FilesMatch>
</IfModule>
"""


def progress(transferred: int, total: int) -> None:
    if total <= 0:
        return
    pct = transferred * 100 / total
    mb = transferred / (1024 * 1024)
    tot = total / (1024 * 1024)
    sys.stdout.write(f"\r  upload {mb:.1f}/{tot:.1f} MB ({pct:.1f}%)   ")
    sys.stdout.flush()


def main() -> int:
    if not LOCAL_EXE.exists():
        print("Missing installer:", LOCAL_EXE)
        return 1
    if not LOCAL_HTML.exists():
        print("Missing page:", LOCAL_HTML)
        return 1

    size_mb = LOCAL_EXE.stat().st_size / (1024 * 1024)
    print(f"Installer: {LOCAL_EXE.name} ({size_mb:.1f} MB)")
    print(f"Target: {USER}@{HOST}:{REMOTE_DIR}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=60, banner_timeout=60, auth_timeout=60)

    # Ensure directory exists
    stdin, stdout, stderr = client.exec_command(f"mkdir -p {REMOTE_DIR}", timeout=60)
    stdout.channel.recv_exit_status()

    sftp = client.open_sftp()
    try:
        sftp.get_channel().settimeout(60 * 60)
    except Exception:
        pass

    print("→ Uploading index.html")
    sftp.put(str(LOCAL_HTML), REMOTE_HTML)

    print("→ Writing .htaccess")
    with sftp.file(REMOTE_HTACCESS, "w") as f:
        f.write(HTACCESS)

    print("→ Uploading installer (this can take a while)")
    t0 = time.time()
    sftp.put(str(LOCAL_EXE), REMOTE_EXE, callback=progress)
    print()
    elapsed = time.time() - t0
    print(f"✓ Upload done in {elapsed:.0f}s")

    # Verify remote size
    st = sftp.stat(REMOTE_EXE)
    print(f"✓ Remote size: {st.st_size / (1024*1024):.1f} MB")
    sftp.close()

    # Quick listing
    stdin, stdout, stderr = client.exec_command(f"ls -lh {REMOTE_DIR}", timeout=60)
    print(stdout.read().decode("utf-8", "replace"))
    client.close()

    print("URL: https://agent.assistix.org/download/")
    print("EXE: https://agent.assistix.org/download/Beam-Agent-Setup-0.1.0-beta.exe")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
