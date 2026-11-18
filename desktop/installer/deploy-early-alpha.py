#!/usr/bin/env python3
"""Upload Beam Agent Early Alpha installer + update feed + download page.

Credentials: ASSISTIX_SSH_PASS / ASSISTIX_SSH_USER / ASSISTIX_SSH_HOST env,
or the same hosting defaults used by other desktop deploy scripts.
Does not print secrets.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from base64 import b64encode
from datetime import datetime, timezone
from pathlib import Path

import paramiko

HOST = os.environ.get("ASSISTIX_SSH_HOST", "31.31.196.221")
USER = os.environ.get("ASSISTIX_SSH_USER", "u3354161")
PASS = os.environ.get("ASSISTIX_SSH_PASS") or os.environ.get("ASSISTIX_SFTP_PASS") or "YOUR_SSH_PASSWORD_HERE"
REMOTE_DIR = "/var/www/u3354161/data/www/agent.assistix.org/download"

ROOT = Path(__file__).resolve().parents[2]
VERSION = "0.1.5"
EXE_NAME = "Beam-Agent-0.1.5-Setup.exe"
LOCAL_EXE = ROOT / "dist" / "installers" / EXE_NAME
LOCAL_HTML = Path(__file__).resolve().parent / "download-index.html"
FEED_DIR = ROOT / "dist" / "installers"

HTACCESS = """# Beam Agent Early Alpha downloads + update feed
Options -Indexes
<IfModule mod_headers.c>
  <FilesMatch "\\.(exe)$">
    Header set Content-Type "application/octet-stream"
    Header set Content-Disposition "attachment"
  </FilesMatch>
  <FilesMatch "\\.(yml|yaml)$">
    Header set Content-Type "text/yaml; charset=utf-8"
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
</IfModule>
"""


def sha512_b64(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return b64encode(h.digest()).decode("ascii")


def write_feed(path: Path, version: str, exe_name: str, size: int, digest: str) -> None:
    release = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    # electron-updater generic provider format
    body = (
        f"version: {version}\n"
        f"files:\n"
        f"  - url: {exe_name}\n"
        f"    sha512: {digest}\n"
        f"    size: {size}\n"
        f"path: {exe_name}\n"
        f"sha512: {digest}\n"
        f"releaseDate: '{release}'\n"
    )
    path.write_text(body, encoding="utf-8")


def progress(transferred: int, total: int) -> None:
    if total <= 0:
        return
    pct = transferred * 100 / total
    mb = transferred / (1024 * 1024)
    tot = total / (1024 * 1024)
    sys.stdout.write(f"\r  upload {mb:.1f}/{tot:.1f} MB ({pct:.1f}%)   ")
    sys.stdout.flush()


def put_atomic(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    tmp = remote + ".part"
    # Drop stale partial from interrupted uploads
    try:
        sftp.remove(tmp)
    except OSError:
        pass
    sftp.put(str(local), tmp, callback=progress if local.stat().st_size > 1_000_000 else None)
    try:
        sftp.remove(remote)
    except OSError:
        pass
    sftp.rename(tmp, remote)


def main() -> int:
    if not LOCAL_EXE.exists():
        print("Missing installer:", LOCAL_EXE)
        return 1
    if not LOCAL_HTML.exists():
        print("Missing page:", LOCAL_HTML)
        return 1

    size = LOCAL_EXE.stat().st_size
    digest = sha512_b64(LOCAL_EXE)
    FEED_DIR.mkdir(parents=True, exist_ok=True)
    nightly = FEED_DIR / "nightly.yml"
    latest = FEED_DIR / "latest.yml"
    write_feed(nightly, VERSION, EXE_NAME, size, digest)
    write_feed(latest, VERSION, EXE_NAME, size, digest)
    meta = {
        "version": VERSION,
        "file": EXE_NAME,
        "size": size,
        "sha512": digest,
        "urls": {
            "page": "https://agent.assistix.org/download/",
            "exe": f"https://agent.assistix.org/download/{EXE_NAME}",
            "nightly": "https://agent.assistix.org/download/nightly.yml",
            "latest": "https://agent.assistix.org/download/latest.yml",
        },
    }
    (FEED_DIR / "update-feed-meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    print(f"Installer: {LOCAL_EXE.name} ({size / (1024 * 1024):.1f} MB)")
    print(f"Version: {VERSION}")
    print(f"Target: {USER}@{HOST}:{REMOTE_DIR}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=60, banner_timeout=60, auth_timeout=60)
    stdin, stdout, stderr = client.exec_command(f"mkdir -p {REMOTE_DIR}", timeout=60)
    stdout.channel.recv_exit_status()

    sftp = client.open_sftp()
    try:
        sftp.get_channel().settimeout(60 * 60)
    except Exception:
        pass

    print("→ Uploading index.html")
    put_atomic(sftp, LOCAL_HTML, f"{REMOTE_DIR}/index.html")

    print("→ Writing .htaccess")
    with sftp.file(f"{REMOTE_DIR}/.htaccess", "w") as f:
        f.write(HTACCESS)

    print("→ Uploading nightly.yml + latest.yml")
    put_atomic(sftp, nightly, f"{REMOTE_DIR}/nightly.yml")
    put_atomic(sftp, latest, f"{REMOTE_DIR}/latest.yml")

    remote_exe = f"{REMOTE_DIR}/{EXE_NAME}"
    # Skip re-upload if remote already matches size (coordinate with in-flight publish)
    skip_exe = False
    try:
        st = sftp.stat(remote_exe)
        if st.st_size == size:
            print(f"→ Installer already on server ({st.st_size} bytes) — keeping")
            skip_exe = True
    except OSError:
        pass

    if not skip_exe:
        # If another agent left a growing .part, wait briefly for it to finish
        part = remote_exe + ".part"
        for _ in range(36):  # up to ~3 minutes
            try:
                pst = sftp.stat(part)
            except OSError:
                break
            print(f"  waiting for in-flight upload ({pst.st_size / (1024*1024):.0f} MB .part)…")
            time.sleep(5)
            try:
                pst2 = sftp.stat(part)
            except OSError:
                break
            if pst2.st_size == pst.st_size:
                # stalled — take over
                print("  .part stalled — taking over upload")
                try:
                    sftp.remove(part)
                except OSError:
                    pass
                break
            if pst2.st_size >= size:
                break
        # If peer finished rename while we waited
        try:
            st = sftp.stat(remote_exe)
            if st.st_size == size:
                print("→ Peer finished upload — using remote installer")
                skip_exe = True
        except OSError:
            pass

    if not skip_exe:
        print("→ Uploading installer (this can take a while)")
        t0 = time.time()
        put_atomic(sftp, LOCAL_EXE, remote_exe)
        print()
        print(f"✓ Upload done in {time.time() - t0:.0f}s")

    st = sftp.stat(remote_exe)
    print(f"✓ Remote installer: {st.st_size / (1024*1024):.1f} MB")
    sftp.close()

    # Stable alias via server-side copy (avoid second 390MB upload)
    alias = f"{REMOTE_DIR}/Beam-Agent-Setup.exe"
    print("→ Refreshing Beam-Agent-Setup.exe alias (server cp)")
    stdin, stdout, stderr = client.exec_command(
        f"cp -f {remote_exe} {alias} && ls -lh {REMOTE_DIR}", timeout=120
    )
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace").strip()
    if err:
        print("cp notes:", err)
    client.close()

    print("PAGE:", meta["urls"]["page"])
    print("EXE:", meta["urls"]["exe"])
    print("ALIAS: https://agent.assistix.org/download/Beam-Agent-Setup.exe")
    print("FEED:", meta["urls"]["nightly"])
    print("FEED:", meta["urls"]["latest"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
