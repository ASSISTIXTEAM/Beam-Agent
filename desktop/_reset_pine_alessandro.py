#!/usr/bin/env python3
"""One-shot: reset Alessandro pine_used only (keep tide/flare)."""
from __future__ import annotations

import json
import os
import urllib.request

import paramiko

PASS = os.environ.get("BP", "YOUR_SSH_PASSWORD_HERE")
KEY = "beam-assistix-ingest-2026-teal"
PHP = r'''<?php
require "/var/www/u3354161/data/www/assistix.org/db.php";
$week = (new DateTimeImmutable("now", new DateTimeZone("UTC")));
$dow = (int)$week->format("N");
$weekStart = $week->modify("-" . ($dow - 1) . " days")->format("Y-m-d");
$email = "alessandro_calandrini@mail.ru";
$st = $pdo->prepare("UPDATE beam_weekly_usage SET pine_used=0 WHERE (id_user_id=3 OR email=?) AND week_start=?");
$st->execute([$email, $weekStart]);
echo "updated=" . $st->rowCount() . " week=$weekStart\n";
$st = $pdo->prepare("SELECT pine_used,pine_limit,tide_used,tide_limit,flare_used,flare_limit FROM beam_weekly_usage WHERE (id_user_id=3 OR email=?) AND week_start=? LIMIT 1");
$st->execute([$email, $weekStart]);
$row = $st->fetch(PDO::FETCH_ASSOC);
echo json_encode($row, JSON_UNESCAPED_UNICODE), "\n";
'''


def main() -> None:
    remote = "/tmp/beam_reset_pine.php"
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
        print("quota", r.read()[:500].decode("utf-8", "replace"))


if __name__ == "__main__":
    main()
