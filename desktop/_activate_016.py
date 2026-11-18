#!/usr/bin/env python3
"""Activate 0.1.6 download page + update feeds after binary is on server disk."""
from __future__ import annotations

import hashlib
import json
import os
import sys
from base64 import b64encode
from datetime import datetime, timezone
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP") or os.environ.get("ASSISTIX_SSH_PASS") or "YOUR_SSH_PASSWORD_HERE"
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN") or "YOUR_UPDATE_TOKEN_HERE"
ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.6"
EXE = "Beam-Agent-0.1.6-Setup.exe"
LOCAL = ROOT / "dist" / "installers" / EXE
HTML = ROOT / "desktop" / "installer" / "download-index.html"
AGENT = "/var/www/u3354161/data/www/agent.assistix.org"
DOWNLOAD = f"{AGENT}/download"
UPDATES = f"{AGENT}/updates"
API = f"{AGENT}/api"
DEST = f"{DOWNLOAD}/{EXE}"
EXPECTED = 421065718


def sha512_b64(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return b64encode(h.digest()).decode("ascii")


def sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def run(c, cmd, timeout=180) -> str:
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("stderr:", err[:400], flush=True)
    return out


def put_text(sftp, remote, text):
    with sftp.file(remote, "w") as f:
        f.write(text)


def main() -> int:
    size = LOCAL.stat().st_size if LOCAL.is_file() else EXPECTED
    digest = sha512_b64(LOCAL) if LOCAL.is_file() else ""
    digest256 = sha256_hex(LOCAL) if LOCAL.is_file() else ""
    print("local", size, digest[:28], flush=True)

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=40, allow_agent=False, look_for_keys=False)
    sftp = c.open_sftp()

    print(
        run(
            c,
            f"""
set -e
PARTIAL="{DEST}.ghpartial"
ALT="{DEST}.partial"
if [ -f "{DEST}" ] && [ "$(stat -c%s "{DEST}")" -eq {EXPECTED} ]; then
  echo FINAL_OK
elif [ -f "$PARTIAL" ] && [ "$(stat -c%s "$PARTIAL")" -eq {EXPECTED} ]; then
  mv -f "$PARTIAL" "{DEST}"; echo MOVED_GH
elif [ -f "$ALT" ] && [ "$(stat -c%s "$ALT")" -eq {EXPECTED} ]; then
  mv -f "$ALT" "{DEST}"; echo MOVED_SFTP
else
  echo MISSING
  ls -la "{DOWNLOAD}"/Beam-Agent-0.1.6* 2>/dev/null || true
  exit 3
fi
cp -f "{DEST}" "{DOWNLOAD}/Beam-Agent-Setup.exe"
cp -f "{DEST}" "{UPDATES}/{EXE}"
cp -f "{DEST}" "{UPDATES}/Beam-Agent-Setup.exe"
ls -la "{DEST}" "{UPDATES}/{EXE}"
""",
            timeout=300,
        ),
        flush=True,
    )

    release = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    notes = (
        "0.1.6: permanently fix desktop boot (dsh.profile.bundles → connection/webServer); "
        "heal beam-only profiles; keep dsh+beam keys in sync."
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
        "downloadUrl": f"https://agent.assistix.org/download/{EXE}",
        "channel": "nightly",
        "minAppVersion": None,
        "feedFile": EXE,
    }

    api = ROOT / "desktop" / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        p = api / name
        if p.is_file():
            sftp.put(str(p), f"{API}/{name}")

    put_text(sftp, f"{DOWNLOAD}/nightly.yml", feed)
    put_text(sftp, f"{DOWNLOAD}/latest.yml", feed)
    put_text(sftp, f"{UPDATES}/nightly.yml", feed)
    put_text(sftp, f"{UPDATES}/latest.yml", feed)
    put_text(sftp, f"{UPDATES}/manifest.json", json.dumps(manifest, indent=2) + "\n")

    if HTML.is_file():
        html = HTML.read_text(encoding="utf-8")
        for old in ("0.1.5", "0.1.4", "0.1.3-early-alpha", "0.1.3"):
            html = html.replace(old, VERSION)
        put_text(sftp, f"{DOWNLOAD}/index.html", html)

    body = {
        "version": VERSION,
        "notes": notes,
        "channel": "nightly",
        "packagePath": DEST,
        "file": EXE,
    }
    put_text(sftp, f"{DOWNLOAD}/_publish_016.json", json.dumps(body))
    print(
        "publish-api:",
        run(
            c,
            "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
            "-H 'Content-Type: application/json' "
            f"-H 'X-Beam-Update-Token: {TOKEN}' "
            f"--data-binary @{DOWNLOAD}/_publish_016.json",
        )[:800],
        flush=True,
    )

    for url in (
        "https://agent.assistix.org/download/nightly.yml",
        "https://agent.assistix.org/download/latest.yml",
        "https://agent.assistix.org/api/check-update.php?current=0.1.5",
        "https://agent.assistix.org/updates/manifest.json",
    ):
        print("---", url, flush=True)
        print(run(c, f"curl -sS {url!r} | head -c 700"), flush=True)

    print("--- page", flush=True)
    print(
        run(
            c,
            "curl -sS 'https://agent.assistix.org/download/' | tr -d '\\r' | grep -E '0\\.1\\.|Setup\\.exe|badge|verLine' | head -25",
        ),
        flush=True,
    )
    print(
        run(
            c,
            f"curl -sSI 'https://agent.assistix.org/download/{EXE}' | tr -d '\\r' | sed -n '1,12p'",
        ),
        flush=True,
    )
    sftp.close()
    c.close()
    print("ACTIVATED 0.1.6", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
