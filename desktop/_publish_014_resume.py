#!/usr/bin/env python3
"""Resume-capable publish for Beam Agent 0.1.4 (SFTP keepalive + append)."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
TOKEN = os.environ.get("BEAM_UPDATE_TOKEN", "YOUR_UPDATE_TOKEN_HERE")
AGENT_ROOT = "/var/www/u3354161/data/www/agent.assistix.org"
API = f"{AGENT_ROOT}/api"
VERSION = "0.1.4"
NOTES = (
    "0.1.4: quota rewrite + soft-block sync, reconnect fixes, tools/icons polish, "
    "bridge update UX. Clean semver so 0.1.3 / 0.1.3-early-alpha clients see Update."
)
CHANNEL = "nightly"
ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "dist" / "installers" / "Beam-Agent-0.1.4-Setup.exe"
REMOTE_TMP = f"/tmp/beam-update-{VERSION}.exe"
CHUNK = 1024 * 1024


def sha512_b64(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return base64.b64encode(h.digest()).decode("ascii")


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=60, banner_timeout=60, auth_timeout=60)
    t = c.get_transport()
    t.set_keepalive(15)
    sftp = c.open_sftp()
    try:
        sftp.get_channel().settimeout(60 * 60)
    except Exception:
        pass
    return c, sftp


def remote_size(sftp, path: str) -> int:
    try:
        return int(sftp.stat(path).st_size)
    except IOError:
        return 0


def upload_resume(sftp, local: Path, remote: str) -> None:
    total = local.stat().st_size
    offset = remote_size(sftp, remote)
    if offset > total:
        print(f"remote larger than local ({offset}>{total}); truncating", flush=True)
        sftp.remove(remote)
        offset = 0
    if offset == total:
        print(f"already complete {total} bytes", flush=True)
        return
    print(f"resume upload from {offset}/{total} ({offset * 100 / total:.1f}%)", flush=True)
    last_pct = -1
    with local.open("rb") as lf:
        lf.seek(offset)
        mode = "ab" if offset else "wb"
        with sftp.file(remote, mode) as rf:
            rf.set_pipelined(True)
            sent = offset
            while True:
                data = lf.read(CHUNK)
                if not data:
                    break
                rf.write(data)
                sent += len(data)
                pct = int(sent * 100 / total)
                if pct != last_pct and (pct % 5 == 0 or sent == total):
                    last_pct = pct
                    print(
                        f"  upload {sent / (1024 * 1024):.1f}/{total / (1024 * 1024):.1f} MB ({pct}%)",
                        flush=True,
                    )
    final = remote_size(sftp, remote)
    if final != total:
        raise RuntimeError(f"size mismatch remote={final} local={total}")
    print("upload complete", sha512_b64(local)[:24] + "...", flush=True)


def main() -> int:
    if not LOCAL.is_file():
        print("missing package", LOCAL, file=sys.stderr)
        return 1

    attempts = 0
    while True:
        attempts += 1
        c = None
        sftp = None
        try:
            print(f"connect attempt {attempts}", flush=True)
            c, sftp = connect()
            local_api = Path(__file__).resolve().parent / "_admin_remote" / "api"
            for name in ("check-update.php", "publish-update.php"):
                local = local_api / name
                remote = f"{API}/{name}"
                sftp.put(str(local), remote)
                sftp.chmod(remote, 0o644)
                print("put", remote, flush=True)

            upload_resume(sftp, LOCAL, REMOTE_TMP)

            body = json.dumps(
                {
                    "version": VERSION,
                    "notes": NOTES,
                    "channel": CHANNEL,
                    "packagePath": REMOTE_TMP,
                    "file": LOCAL.name,
                }
            )
            body_remote = "/tmp/beam-publish-body.json"
            with sftp.file(body_remote, "w") as f:
                f.write(body)

            cmd = (
                f"curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
                f"-H 'Content-Type: application/json' "
                f"-H 'X-Beam-Update-Token: {TOKEN}' "
                f"--data-binary @{body_remote}"
            )
            stdin, stdout, stderr = c.exec_command(cmd, timeout=180)
            out = stdout.read().decode("utf-8", "replace")
            err = stderr.read().decode("utf-8", "replace")
            print(out, flush=True)
            if err.strip():
                print(err, file=sys.stderr, flush=True)

            stdin, stdout, stderr = c.exec_command(
                "curl -sS 'https://agent.assistix.org/api/check-update.php?current=0.1.3'"
            )
            verify = stdout.read().decode("utf-8", "replace")
            print("check-update:", verify, flush=True)

            sftp.close()
            c.close()
            data = json.loads(out)
            if not data.get("ok"):
                return 2
            print("DONE", flush=True)
            return 0
        except Exception as e:
            print(f"attempt {attempts} failed: {type(e).__name__}: {e}", flush=True)
            try:
                if sftp:
                    sftp.close()
                if c:
                    c.close()
            except Exception:
                pass
            if attempts >= 8:
                return 1
            time.sleep(min(30, 3 * attempts))


if __name__ == "__main__":
    raise SystemExit(main())
