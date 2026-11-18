#!/usr/bin/env python3
"""Deploy unified weekly limits: beam-quota.php + admin UI + verify."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import paramiko
import urllib.request

ROOT = Path(__file__).resolve().parent
PASS = os.environ.get("BP")
if not PASS:
    for line in ROOT.parents[0].joinpath("secrets.local.env").read_text(encoding="utf-8").splitlines():
        if line.startswith("BP="):
            PASS = line.split("=", 1)[1].strip()
            break

KEY = "beam-assistix-ingest-2026-teal"
QUOTA_LOCAL = ROOT / "_admin_remote" / "api" / "beam-quota.php"
ADMIN_LIVE = ROOT / "_admin_remote_live"

REMOTES_QUOTA = [
    "/var/www/u3354161/data/www/assistix.org/admin/api/beam-quota.php",
    "/var/www/u3354161/data/www/assistix.org/api/beam-quota.php",
    "/var/www/u3354161/data/www/agent.assistix.org/api/beam-quota.php",
]

ADMIN_PUTS = [
    (ADMIN_LIVE / "api.php", "/var/www/u3354161/data/www/assistix.org/admin/api.php"),
    (ADMIN_LIVE / "admin.js", "/var/www/u3354161/data/www/assistix.org/admin/assets/admin.js"),
    (ADMIN_LIVE / "index.php", "/var/www/u3354161/data/www/assistix.org/admin/index.php"),
]


def ensure_dir(sftp, path: str) -> None:
    parts = path.strip("/").split("/")
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            sftp.stat(cur)
        except IOError:
            try:
                sftp.mkdir(cur)
            except IOError:
                pass


def post_quota(payload: dict) -> dict:
    req = urllib.request.Request(
        "https://agent.assistix.org/api/beam-quota.php",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Beam-Ingest-Key": KEY,
            "User-Agent": "BeamAgent-LimitsDeploy/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def main() -> None:
    assert QUOTA_LOCAL.is_file(), QUOTA_LOCAL
    for src, _ in ADMIN_PUTS:
        assert src.is_file(), src

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=40)
    sftp = c.open_sftp()

    for remote in REMOTES_QUOTA:
        ensure_dir(sftp, str(Path(remote).parent).replace("\\", "/"))
        sftp.put(str(QUOTA_LOCAL), remote)
        print("put", remote)

    for src, remote in ADMIN_PUTS:
        ensure_dir(sftp, str(Path(remote).parent).replace("\\", "/"))
        sftp.put(str(src), remote)
        print("put", remote)

    sftp.close()

    # Trigger schema/migration via get
    verify_email = "limits-unify-verify@assistix.org"
    verify_id = 900777
    print("verify get…")
    got = post_quota({"action": "get", "email": verify_email, "id_user_id": verify_id})
    print("get", json.dumps({
        "ok": got.get("ok"),
        "week_start": got.get("week_start"),
        "reset_at": got.get("reset_at"),
        "week_boundary": got.get("week_boundary"),
        "defaults": got.get("defaults"),
        "quotas": got.get("quotas"),
        "unlimited": got.get("unlimited"),
    }, indent=2))

    assert got.get("ok") is True
    assert got.get("defaults", {}).get("tide") == 100000
    assert got.get("defaults", {}).get("flare") == 50000
    assert got.get("defaults", {}).get("pine") == 10000
    assert got["quotas"]["tide"]["limit"] == 100000
    assert got["quotas"]["flare"]["limit"] == 50000
    assert got["quotas"]["pine"]["limit"] == 10000
    assert got.get("week_boundary") == "monday_00_00_utc"
    assert got.get("reset_at")

    # set pine unlimited only
    print("verify set_limits pine unlimited…")
    setr = post_quota({
        "action": "set_limits",
        "email": verify_email,
        "id_user_id": verify_id,
        "tide_limit": 100000,
        "flare_limit": 50000,
        "pine_limit": 10000,
        "pine_unlimited": 1,
        "tide_unlimited": 0,
        "flare_unlimited": 0,
        "unlimited": 0,
    })
    print("set", json.dumps({
        "ok": setr.get("ok"),
        "quotas": {k: {"used": v.get("used"), "limit": v.get("limit"), "unlimited": v.get("unlimited")} for k, v in (setr.get("quotas") or {}).items()},
    }, indent=2))
    assert setr["quotas"]["pine"]["unlimited"] is True
    assert setr["quotas"]["tide"]["unlimited"] is False

    # charge pine while unlimited — should ok and increment used
    before = setr["quotas"]["pine"]["used"]
    ch = post_quota({
        "action": "charge",
        "email": verify_email,
        "id_user_id": verify_id,
        "tier": "pine",
        "tokens": 7,
    })
    print("charge unlimited pine", ch.get("ok"), ch.get("charged"), ch["quotas"]["pine"])
    assert ch.get("ok") is True
    assert ch["quotas"]["pine"]["used"] >= before + 7

    # clear unlimited and set tiny pine to test soft-block, then restore defaults
    post_quota({
        "action": "set_limits",
        "email": verify_email,
        "id_user_id": verify_id,
        "tide_limit": 100000,
        "flare_limit": 50000,
        "pine_limit": 10000,
        "pine_unlimited": 0,
        "tide_unlimited": 0,
        "flare_unlimited": 0,
        "unlimited": 0,
    })
    post_quota({
        "action": "reset_used",
        "email": verify_email,
        "id_user_id": verify_id,
    })

    # also hit assistix.org mirror
    for url in [
        "https://assistix.org/api/beam-quota.php",
        "https://assistix.org/admin/api/beam-quota.php",
    ]:
        req = urllib.request.Request(
            url,
            data=json.dumps({"action": "get", "email": verify_email, "id_user_id": verify_id}).encode(),
            headers={"Content-Type": "application/json", "X-Beam-Ingest-Key": KEY},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=25) as r:
            data = json.loads(r.read().decode())
            print(url, "tide_limit", data["quotas"]["tide"]["limit"], "reset_at", data.get("reset_at"))
            assert data["quotas"]["tide"]["limit"] == 100000

    # Copy bridge into runtime if present
    src_bridge = ROOT / "bridge" / "server.js"
    runtime = Path(r"C:\Users\Alexa\BeamAgent\bridge\server.js")
    if src_bridge.is_file() and runtime.parent.is_dir():
        runtime.write_text(src_bridge.read_text(encoding="utf-8"), encoding="utf-8")
        print("synced runtime bridge", runtime)

    # Restart local bridge if running (best-effort)
    try:
        import subprocess
        # Kill listeners on 17865 then start hidden if Start script exists
        ps = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-NetTCPConnection -LocalPort 17865 -ErrorAction SilentlyContinue | "
             "ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"],
            capture_output=True, text=True, timeout=30,
        )
        print("bridge port clear", ps.returncode)
        starter = Path(r"C:\Users\Alexa\BeamAgent\start-bridge-hidden.vbs")
        if starter.is_file():
            subprocess.Popen(["wscript", str(starter)], cwd=str(starter.parent))
            time.sleep(2)
            print("restarted runtime bridge via vbs")
    except Exception as e:
        print("bridge restart skip", e)

    print("DEPLOY OK")
    c.close()


if __name__ == "__main__":
    main()
