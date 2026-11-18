#!/usr/bin/env python3
"""If download/Beam-Agent-0.1.5-Setup.exe is complete, activate feeds/page/API; else FTP-upload then activate."""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from base64 import b64encode
from datetime import datetime, timezone
from ftplib import FTP
from pathlib import Path

import paramiko

PASS = os.environ.get("BP") or "mBvnX4CGq1w74JRF"
FTP_PASS = os.environ.get("ASSISTIX_FTP_PASS") or "7oQd4Hw2eF1aJ1Cj"
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN") or "YOUR_UPDATE_TOKEN_HERE"
HOST = "31.31.196.221"
USER = "u3354161"

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "dist" / "installers" / "Beam-Agent-0.1.5-Setup.exe"
HTML = ROOT / "desktop" / "installer" / "download-index.html"
EXE = "Beam-Agent-0.1.5-Setup.exe"
VERSION = "0.1.5"
AGENT = "/var/www/u3354161/data/www/agent.assistix.org"
DOWNLOAD = f"{AGENT}/download"
UPDATES = f"{AGENT}/updates"
API = f"{AGENT}/api"


def digests(path: Path):
    h512 = hashlib.sha512()
    h256 = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h512.update(b)
            h256.update(b)
    return b64encode(h512.digest()).decode(), h256.hexdigest(), path.stat().st_size


def ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username=USER,
        password=PASS,
        timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = c.open_sftp()
    return c, sftp


def run(c, cmd, timeout=180):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("stderr:", err[:400], flush=True)
    return out


def remote_size(sftp, path):
    try:
        return sftp.stat(path).st_size
    except IOError:
        return -1


def ftp_upload(local: Path, remote_name: str):
    print("FTP upload start", flush=True)
    ftp = FTP()
    ftp.connect(HOST, 21, timeout=60)
    ftp.login(USER, FTP_PASS)
    ftp.set_pasv(True)
    ftp.cwd("www/agent.assistix.org/download")
    # resume if .partial exists
    tmp = remote_name + ".ftp-part"
    offset = 0
    try:
        size = ftp.size(tmp)
        if isinstance(size, int) and size > 0:
            offset = size
            print("FTP resume", offset, flush=True)
    except Exception:
        offset = 0

    with local.open("rb") as f:
        if offset:
            f.seek(offset)
        total = local.stat().st_size
        sent = [offset]
        last = [-1]

        def cb(n):
            sent[0] += n
            pct = int(sent[0] * 100 / total)
            if pct != last[0] and (pct % 2 == 0 or sent[0] == total):
                last[0] = pct
                print(
                    f"  FTP {sent[0]/(1024*1024):.1f}/{total/(1024*1024):.1f} MB ({pct}%)",
                    flush=True,
                )

        if offset:
            ftp.storbinary(f"STOR {tmp}", f, blocksize=1024 * 256, rest=offset, callback=cb)
        else:
            ftp.storbinary(f"STOR {tmp}", f, blocksize=1024 * 256, callback=cb)

    # rename into place
    try:
        ftp.delete(remote_name)
    except Exception:
        pass
    ftp.rename(tmp, remote_name)
    print("FTP done size=", ftp.size(remote_name), flush=True)
    ftp.quit()


def activate(c, sftp, digest, digest256, size):
    remote = f"{DOWNLOAD}/{EXE}"
    print(
        run(
            c,
            f"""set -e
cp -f {remote} {DOWNLOAD}/Beam-Agent-Setup.exe
cp -f {remote} {UPDATES}/{EXE}
cp -f {remote} {UPDATES}/Beam-Agent-Setup.exe
ls -la {remote} {UPDATES}/{EXE}
""",
            timeout=300,
        ),
        flush=True,
    )

    release = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    notes = (
        "0.1.5: fix Desktop Host ready timeout (boot waits host+auth only), "
        "soft runtime version drift, splash/boot caps, bridge :17865, stability tray."
    )
    feed = (
        f"version: {VERSION}\n"
        f"files:\n"
        f"  - url: {EXE}\n"
        f"    sha512: {digest}\n"
        f"    size: {size}\n"
        f"path: {EXE}\n"
        f"sha512: {digest}\n"
        f"releaseDate: '{release}'\n"
    )
    manifest = {
        "ok": True,
        "version": VERSION,
        "releaseDate": release,
        "notes": notes,
        "changelog": notes,
        "file": EXE,
        "stableFile": "Beam-Agent-Setup.exe",
        "size": size,
        "sha512": digest,
        "sha256": digest256,
        "downloadUrl": f"https://agent.assistix.org/updates/{EXE}",
        "channel": "nightly",
        "minAppVersion": None,
        "feedFile": EXE,
    }
    for name, text in (("nightly.yml", feed), ("latest.yml", feed)):
        with sftp.file(f"{DOWNLOAD}/{name}", "w") as f:
            f.write(text)
    with sftp.file(f"{UPDATES}/manifest.json", "w") as f:
        f.write(json.dumps(manifest, indent=2) + "\n")

    html = HTML.read_text(encoding="utf-8")
    html = html.replace("0.1.4", VERSION).replace("0.1.3-early-alpha", VERSION)
    html = html.replace("EARLY ALPHA · Windows · 0.1.3", f"EARLY ALPHA · Windows · {VERSION}")
    html = html.replace(">0.1.3<", f">{VERSION}<")
    with sftp.file(f"{DOWNLOAD}/index.html", "w") as f:
        f.write(html)

    api = ROOT / "desktop" / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        p = api / name
        if p.is_file():
            sftp.put(str(p), f"{API}/{name}")

    body = {
        "version": VERSION,
        "notes": notes,
        "channel": "nightly",
        "packagePath": remote,
        "file": EXE,
    }
    with sftp.file("/tmp/beam-publish-015.json", "w") as f:
        f.write(json.dumps(body))
    print(
        "publish-api:",
        run(
            c,
            "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
            "-H 'Content-Type: application/json' "
            f"-H 'X-Beam-Update-Token: {TOKEN}' "
            "--data-binary @/tmp/beam-publish-015.json",
        )[:1200],
        flush=True,
    )

    for url in (
        "https://agent.assistix.org/download/nightly.yml",
        "https://agent.assistix.org/download/latest.yml",
        "https://agent.assistix.org/api/check-update.php?current=0.1.3",
        "https://agent.assistix.org/api/check-update.php?current=0.1.4",
        "https://agent.assistix.org/updates/manifest.json",
    ):
        print("---", url, flush=True)
        print(run(c, f"curl -sS {url!r} | head -c 800"), flush=True)

    print("--- page", flush=True)
    print(
        run(
            c,
            "curl -sS 'https://agent.assistix.org/download/' | tr -d '\\r' | grep -E '0\\.1\\.|Setup\\.exe|badge|verLine' | head -30",
        ),
        flush=True,
    )
    print(
        run(
            c,
            f"curl -sSI 'https://agent.assistix.org/download/{EXE}' | tr -d '\\r' | sed -n '1,15p'",
        ),
        flush=True,
    )
    print("SHIPPED", VERSION, flush=True)


def main() -> int:
    if not LOCAL.is_file():
        print("missing", LOCAL)
        return 1
    digest, digest256, size = digests(LOCAL)
    print("local", size, digest[:28], flush=True)

    c, sftp = ssh()
    remote = f"{DOWNLOAD}/{EXE}"
    rs = remote_size(sftp, remote)
    print("remote size", rs, flush=True)

    if rs != size:
        sftp.close()
        c.close()
        # FTP upload then reconnect
        for attempt in range(1, 4):
            try:
                ftp_upload(LOCAL, EXE)
                break
            except Exception as e:
                print("FTP fail", attempt, e, flush=True)
                time.sleep(3)
        else:
            return 2
        c, sftp = ssh()
        rs = remote_size(sftp, remote)
        print("remote size after FTP", rs, flush=True)
        if rs != size:
            print("still incomplete", rs, size)
            return 3

    # hash check
    out = run(
        c,
        f"""python3 - <<'PY'
import hashlib, base64, pathlib
p=pathlib.Path({remote!r})
h=hashlib.sha512()
with p.open('rb') as f:
  while True:
    b=f.read(1024*1024)
    if not b: break
    h.update(b)
print(base64.b64encode(h.digest()).decode())
print(p.stat().st_size)
PY""",
        timeout=300,
    )
    print("remote hash out:", out, flush=True)
    if digest not in out:
        print("HASH mismatch — reupload via FTP", flush=True)
        sftp.close()
        c.close()
        ftp_upload(LOCAL, EXE)
        c, sftp = ssh()

    activate(c, sftp, digest, digest256, size)
    sftp.close()
    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
