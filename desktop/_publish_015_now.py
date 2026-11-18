#!/usr/bin/env python3
"""Upload Beam-Agent-0.1.5-Setup.exe and activate as latest on agent.assistix.org."""
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

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP") or os.environ.get("ASSISTIX_SSH_PASS") or "YOUR_SSH_PASSWORD_HERE"
# Live publish-update.php default after last deploy of local stub
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN") or "YOUR_UPDATE_TOKEN_HERE"

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.5"
EXE_NAME = "Beam-Agent-0.1.5-Setup.exe"
LOCAL_EXE = ROOT / "dist" / "installers" / EXE_NAME
LOCAL_HTML = ROOT / "desktop" / "installer" / "download-index.html"
LOCAL_YML_DIR = ROOT / "dist" / "installers"

AGENT = "/var/www/u3354161/data/www/agent.assistix.org"
DOWNLOAD = f"{AGENT}/download"
UPDATES = f"{AGENT}/updates"
API = f"{AGENT}/api"


def sha512_b64(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return b64encode(h.digest()).decode("ascii")


def sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def write_feeds(size: int, digest: str) -> tuple[Path, Path]:
    release = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    body = (
        f"version: {VERSION}\n"
        f"files:\n"
        f"  - url: {EXE_NAME}\n"
        f"    sha512: {digest}\n"
        f"    size: {size}\n"
        f"path: {EXE_NAME}\n"
        f"sha512: {digest}\n"
        f"releaseDate: '{release}'\n"
    )
    LOCAL_YML_DIR.mkdir(parents=True, exist_ok=True)
    nightly = LOCAL_YML_DIR / "nightly.yml"
    latest = LOCAL_YML_DIR / "latest.yml"
    nightly.write_text(body, encoding="utf-8")
    latest.write_text(body, encoding="utf-8")
    return nightly, latest


def put_file(sftp: paramiko.SFTPClient, local: Path, remote: str, show: bool = True) -> None:
    tmp = remote + ".part"
    try:
        sftp.remove(tmp)
    except OSError:
        pass
    total = local.stat().st_size
    last = [-1]

    def cb(transferred: int, size: int) -> None:
        if not show or size <= 0:
            return
        pct = int(transferred * 100 / size)
        if pct != last[0] and (pct % 2 == 0 or transferred == size):
            last[0] = pct
            print(
                f"  {remote.split('/')[-1]} {transferred / (1024 * 1024):.1f}/{size / (1024 * 1024):.1f} MB ({pct}%)",
                flush=True,
            )

    print(f"put {local.name} → {remote} ({total} bytes)", flush=True)
    sftp.put(str(local), tmp, callback=cb if total > 1_000_000 else None)
    try:
        sftp.remove(remote)
    except OSError:
        pass
    sftp.rename(tmp, remote)


def connect() -> tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    for attempt in range(1, 6):
        try:
            c = paramiko.SSHClient()
            c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(
                HOST,
                username=USER,
                password=PASS,
                timeout=40,
                banner_timeout=90,
                auth_timeout=60,
                allow_agent=False,
                look_for_keys=False,
            )
            sftp = c.open_sftp()
            try:
                sftp.get_channel().settimeout(60 * 60)
            except Exception:
                pass
            print(f"ssh ok (attempt {attempt})", flush=True)
            return c, sftp
        except Exception as e:
            print(f"ssh attempt {attempt} failed: {e}", flush=True)
            time.sleep(3)
    raise RuntimeError("ssh connect failed")


def main() -> int:
    if not LOCAL_EXE.is_file():
        print("missing", LOCAL_EXE, file=sys.stderr)
        return 1

    size = LOCAL_EXE.stat().st_size
    digest = sha512_b64(LOCAL_EXE)
    digest256 = sha256_hex(LOCAL_EXE)
    nightly, latest = write_feeds(size, digest)
    print("local sha512", digest[:28] + "...", "size", size, flush=True)

    c, sftp = connect()

    # Ensure dirs
    for d in (DOWNLOAD, UPDATES, API):
        try:
            sftp.stat(d)
        except IOError:
            sftp.mkdir(d)

    # Deploy API scripts (keep token working)
    api_local = ROOT / "desktop" / "_admin_remote" / "api"
    for name in ("check-update.php", "publish-update.php"):
        local = api_local / name
        if local.is_file():
            # Ensure fallback token matches what we use
            text = local.read_text(encoding="utf-8")
            if "YOUR_UPDATE_TOKEN_HERE" in text or "YOUR_UPDATE_TOKEN_HERE" in text:
                text = text.replace(
                    "YOUR_UPDATE_TOKEN_HERE",
                    "YOUR_UPDATE_TOKEN_HERE",
                )
                # leave YOUR_UPDATE_TOKEN_HERE as-is
            # write via temp then put
            tmp = Path(os.environ.get("TEMP", ".")) / f"beam-{name}"
            tmp.write_text(text, encoding="utf-8")
            sftp.put(str(tmp), f"{API}/{name}")
            print("api", name, flush=True)

    # Upload installer to download + updates + stable name
    put_file(sftp, LOCAL_EXE, f"{DOWNLOAD}/{EXE_NAME}")
    put_file(sftp, LOCAL_EXE, f"{DOWNLOAD}/Beam-Agent-Setup.exe", show=False)
    put_file(sftp, LOCAL_EXE, f"{UPDATES}/{EXE_NAME}", show=False)
    put_file(sftp, LOCAL_EXE, f"{UPDATES}/Beam-Agent-Setup.exe", show=False)

    # Feeds + page
    put_file(sftp, nightly, f"{DOWNLOAD}/nightly.yml", show=False)
    put_file(sftp, latest, f"{DOWNLOAD}/latest.yml", show=False)
    if LOCAL_HTML.is_file():
        html = LOCAL_HTML.read_text(encoding="utf-8")
        html = html.replace("0.1.6", VERSION).replace("0.1.3-early-alpha", VERSION).replace("0.1.4", VERSION)
        if "0.1.5" not in html:
            # force version text if template uses placeholders
            pass
        tmp_html = Path(os.environ.get("TEMP", ".")) / "beam-download-index.html"
        tmp_html.write_text(html, encoding="utf-8")
        put_file(sftp, tmp_html, f"{DOWNLOAD}/index.html", show=False)

    # Manifest for check-update
    release = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest = {
        "ok": True,
        "version": VERSION,
        "releaseDate": release,
        "notes": "Beam Agent 0.1.5 — Desktop Host boot fix, soft runtime drift, splash/boot caps, bridge :17865.",
        "changelog": "Beam Agent 0.1.5 — Desktop Host boot fix, soft runtime drift, splash/boot caps, bridge :17865.",
        "file": EXE_NAME,
        "stableFile": "Beam-Agent-Setup.exe",
        "size": size,
        "sha512": digest,
        "sha256": digest256,
        "downloadUrl": f"https://agent.assistix.org/updates/{EXE_NAME}",
        "channel": "nightly",
        "minAppVersion": None,
        "feedFile": EXE_NAME,
    }
    tmp_manifest = Path(os.environ.get("TEMP", ".")) / "beam-manifest.json"
    tmp_manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    put_file(sftp, tmp_manifest, f"{UPDATES}/manifest.json", show=False)

    # Also activate via publish API using server-local copy
    body = {
        "version": VERSION,
        "notes": manifest["notes"],
        "channel": "nightly",
        "packagePath": f"{DOWNLOAD}/{EXE_NAME}",
        "file": EXE_NAME,
    }
    body_remote = "/tmp/beam-publish-body-015.json"
    with sftp.file(body_remote, "w") as f:
        f.write(json.dumps(body))
    cmd = (
        "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        "-H 'Content-Type: application/json' "
        f"-H 'X-Beam-Update-Token: {TOKEN}' "
        f"--data-binary @{body_remote}"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=180)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    print("publish-api:", out[:800], flush=True)
    if err.strip():
        print("publish-api-err:", err[:400], flush=True)

    # Verify remotely
    for url in (
        "https://agent.assistix.org/download/nightly.yml",
        "https://agent.assistix.org/download/latest.yml",
        "https://agent.assistix.org/api/check-update.php?current=0.1.3",
        "https://agent.assistix.org/api/check-update.php?current=0.1.4",
        "https://agent.assistix.org/updates/manifest.json",
    ):
        stdin, stdout, stderr = c.exec_command(f"curl -sS {url!r} | head -c 500")
        print("---", url, flush=True)
        print(stdout.read().decode("utf-8", "replace"), flush=True)

    sftp.close()
    c.close()
    print("DONE 0.1.5", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
