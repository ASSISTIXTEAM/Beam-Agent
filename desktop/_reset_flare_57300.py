#!/usr/bin/env python3
"""Reconcile Alessandro Flare after empty-stream overcharge + soft-block desync."""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

import paramiko

PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
KEY = "beam-assistix-ingest-2026-teal"
TARGET = 57300
PHP = r"""<?php
require "/var/www/u3354161/data/www/assistix.org/db.php";
$week = (new DateTimeImmutable("now", new DateTimeZone("UTC")));
$dow = (int)$week->format("N");
$weekStart = $week->modify("-" . ($dow - 1) . " days")->format("Y-m-d");
$email = "alessandro_calandrini@mail.ru";
$st = $pdo->prepare("SELECT id,flare_used,flare_limit,tide_used,pine_used FROM beam_weekly_usage WHERE (id_user_id=3 OR email=?) AND week_start=? ORDER BY id");
$st->execute([$email, $weekStart]);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);
echo "before=" . json_encode($rows, JSON_UNESCAPED_UNICODE) . "\n";
$st = $pdo->prepare("UPDATE beam_weekly_usage SET flare_used=? WHERE (id_user_id=3 OR email=?) AND week_start=?");
$st->execute([57300, $email, $weekStart]);
echo "updated=" . $st->rowCount() . " week=$weekStart target=57300\n";
$st = $pdo->prepare("SELECT id,id_user_id,email,flare_used,flare_limit,tide_used,pine_used FROM beam_weekly_usage WHERE (id_user_id=3 OR email=?) AND week_start=?");
$st->execute([$email, $weekStart]);
echo "after=" . json_encode($st->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE) . "\n";
"""


def main() -> None:
    remote = "/tmp/beam_reset_flare.php"
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect("31.31.196.221", username="u3354161", password=PASS, timeout=40)
    sftp = c.open_sftp()
    with sftp.file(remote, "w") as f:
        f.write(PHP)
    sftp.close()
    stdin, stdout, stderr = c.exec_command(f"php {remote}")
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("err", err[:400])
    c.exec_command(f"rm -f {remote}")
    c.close()

    req = urllib.request.Request(
        "https://agent.assistix.org/api/beam-quota.php",
        data=json.dumps(
            {"action": "get", "email": "alessandro_calandrini@mail.ru", "id_user_id": 3}
        ).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Beam-Ingest-Key": KEY,
            "User-Agent": "BeamAgent/0.1",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode("utf-8", "replace"))
    print("api_get", json.dumps(data.get("quotas"), ensure_ascii=False))

    state_path = Path(os.environ.get("USERPROFILE", "")) / ".beam" / "bridge" / "state.json"
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        state.setdefault("quotas", {})["flare"] = {
            "used": TARGET,
            "limit": int(data.get("quotas", {}).get("flare", {}).get("limit") or 100000),
        }
        if isinstance(state.get("quotaServer"), dict):
            state["quotaServer"]["lastChargeAt"] = None
            state["quotaServer"]["at"] = "1970-01-01T00:00:00.000Z"
        state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        print("local_state flare set to", TARGET)


if __name__ == "__main__":
    main()
