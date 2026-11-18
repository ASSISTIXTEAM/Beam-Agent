#!/usr/bin/env python3
"""Fetch ASSISTIX ID API sources and/or probe login flow."""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

HOST = "31.31.196.221"
SSH_USER = "u3354161"
SSH_PASS = "YOUR_SSH_PASSWORD_HERE"
ID = "https://id.assistix.org"


def ssh_fetch():
    import paramiko

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=SSH_USER, password=SSH_PASS, timeout=25, allow_agent=False, look_for_keys=False)
    _, stdout, _ = ssh.exec_command(
        "find /var/www /home /www -maxdepth 5 -type d -name 'id.assistix.org' 2>/dev/null | head -5",
        timeout=30,
    )
    roots = [ln.strip() for ln in stdout.read().decode().splitlines() if ln.strip()]
    print("ROOTS", roots)
    if not roots:
        ssh.close()
        return
    root = roots[0]
    for rel in [
        "api/login-actions.php",
        "api/oauth-finish.php",
        "api/exchange.php",
        "api/bootstrap-login.php",
    ]:
        path = f"{root}/{rel}"
        _, stdout, _ = ssh.exec_command(f"wc -c {path}; sed -n '1,220p' {path}", timeout=30)
        out = stdout.read().decode("utf-8", "replace")
        print(f"\n==== {rel} ====")
        print(out[:8000])
    ssh.close()


def http_probe_wrong():
    boundary = "----beamprobe"
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="action"\r\n\r\nlogin_password\r\n'
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="email"\r\n\r\nalessandro_calandrini@mail.ru\r\n'
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="password"\r\n\r\nwrong-probe\r\n'
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="redirect_uri"\r\n\r\n'
        "http://127.0.0.1:17865/assistix/callback\r\n"
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="client_id"\r\n\rassistix-chat\r\n'
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="state"\r\n\reyJhcHAiOiJiZWFtLWFnZW50In0\r\n'
        f"--{boundary}--\r\n"
    ).encode()
    req = urllib.request.Request(
        f"{ID}/api/login-actions.php",
        data=body,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
            "Origin": ID,
            "Referer": f"{ID}/auth/",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print("wrong status", resp.status)
            print("wrong body", resp.read()[:500])
            print("set-cookie", resp.headers.get_all("Set-Cookie"))
    except urllib.error.HTTPError as e:
        print("wrong status", e.code)
        print("wrong body", e.read()[:500])
        print("set-cookie", e.headers.get_all("Set-Cookie") if hasattr(e.headers, "get_all") else e.headers.get("Set-Cookie"))


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "ssh"
    if mode == "ssh":
        ssh_fetch()
    else:
        http_probe_wrong()
