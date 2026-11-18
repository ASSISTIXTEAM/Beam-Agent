#!/usr/bin/env python3
"""Final 0.1.5 publish: unique remote tmp + activate. Requires BP + BEAM_UPDATE_TOKEN."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = os.environ["BP"]
TOKEN = os.environ["BEAM_UPDATE_TOKEN"]
ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "dist" / "installers" / "Beam-Agent-0.1.5-Setup.exe"
API = "/var/www/u3354161/data/www/agent.assistix.org/api"
REMOTE_TMP = f"/tmp/beam-015-final-{int(time.time())}.exe"


def connect():
    last = None
    for i in range(1, 10):
        try:
            c = paramiko.SSHClient()
            c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c.connect(
                HOST,
                username=USER,
                password=PASS,
                timeout=60,
                banner_timeout=180,
                auth_timeout=90,
                allow_agent=False,
                look_for_keys=False,
            )
            sftp = c.open_sftp()
            try:
                sftp.get_channel().settimeout(3 * 60 * 60)
            except Exception:
                pass
            print(f"ssh ok attempt={i}", flush=True)
            return c, sftp
        except Exception as e:
            last = e
            print(f"ssh fail {i}: {e}", flush=True)
            time.sleep(3 + i)
    raise RuntimeError(last)


def main() -> int:
    if not PKG.is_file():
        print("missing", PKG)
        return 1
    total = PKG.stat().st_size
    print(f"local {PKG.name} {total} bytes → {REMOTE_TMP}", flush=True)

    c, sftp = connect()

    # Ensure API token on server matches our env token
    for name in ("check-update.php", "publish-update.php"):
        text = (ROOT / "desktop/_admin_remote/api" / name).read_text(encoding="utf-8")
        text = text.replace("YOUR_UPDATE_TOKEN_HERE", TOKEN)
        with sftp.file(f"{API}/{name}", "w") as f:
            f.write(text)
        print("api", name, flush=True)

    last = [-1]

    def progress(tr, size):
        pct = int(tr * 100 / size) if size else 0
        if pct != last[0] and (pct % 2 == 0 or tr == size):
            last[0] = pct
            print(f"  {tr/(1024*1024):.1f}/{size/(1024*1024):.1f} MB ({pct}%)", flush=True)

    sftp.put(str(PKG), REMOTE_TMP, callback=progress, confirm=False)
    # verify via SSH stat (not SFTP confirm)
    out = c.exec_command(f"stat -c%s {REMOTE_TMP}")[1].read().decode().strip()
    print("remote size", out, "local", total, flush=True)
    if out != str(total):
        raise RuntimeError(f"size mismatch remote={out} local={total}")

    body = json.dumps(
        {
            "version": "0.1.5",
            "notes": "Beam Agent 0.1.5: auth flicker/black screen fix, quota sync, reconnect, icons, tools; supersedes 0.1.3/0.1.4",
            "channel": "nightly",
            "packagePath": REMOTE_TMP,
            "file": PKG.name,
        }
    )
    with sftp.file("/tmp/beam-publish-015-final.json", "w") as f:
        f.write(body)
    pub = c.exec_command(
        "curl -sS -X POST 'https://agent.assistix.org/api/publish-update.php' "
        "-H 'Content-Type: application/json' "
        f"-H 'X-Beam-Update-Token: {TOKEN}' "
        "--data-binary @/tmp/beam-publish-015-final.json",
        timeout=180,
    )[1].read().decode()
    print("PUBLISH:", pub, flush=True)

    for q in ("0.1.3-early-alpha", "0.1.4", "0.1.5"):
        chk = c.exec_command(
            f"curl -sS 'https://agent.assistix.org/api/check-update.php?current={q}'"
        )[1].read().decode()
        print(f"CHECK {q}:", chk, flush=True)
    print(
        "FEED:",
        c.exec_command("curl -sS 'https://agent.assistix.org/download/nightly.yml'")[1]
        .read()
        .decode(),
        flush=True,
    )
    sftp.close()
    c.close()
    print("SHIPPED 0.1.5", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
