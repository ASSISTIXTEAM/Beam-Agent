#!/usr/bin/env python3
"""Pull ASSISTIX ID OAuth core with fresh connection per file (reg.ru FTP is flaky)."""
import ftplib
from pathlib import Path

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"
ROOT = "/www/id.assistix.org"
OUT = Path(__file__).resolve().parent / "_id_site_snap"
OUT.mkdir(parents=True, exist_ok=True)

FILES = [
    "api/authorize.php",
    "api/exchange.php",
    "api/me.php",
    "api/oauth-status.php",
    "api/devices.php",
    "api/logout.php",
    "api/_boot.php",
    "api/_bootstrap.php",
    "auth/auth-app.js",
    "config.example.php",
    "index.html",
]


def pull(rel: str) -> None:
    local = OUT / rel.replace("/", "__")
    f = ftplib.FTP()
    f.connect(HOST, 21, timeout=45)
    f.login(USER, PASS)
    f.set_pasv(True)
    f.voidcmd("TYPE I")
    remote = f"{ROOT}/{rel}"
    with open(local, "wb") as out:
        f.retrbinary(f"RETR {remote}", out.write)
    f.quit()
    print(f"OK {rel} ({local.stat().st_size})")


def list_dir(rel: str) -> None:
    f = ftplib.FTP()
    f.connect(HOST, 21, timeout=45)
    f.login(USER, PASS)
    f.cwd(f"{ROOT}/{rel}")
    names = [n for n in f.nlst() if n not in (".", "..")]
    f.quit()
    print(f"DIR {rel}: {names}")


list_dir("api/oauth")
for rel in FILES:
    try:
        pull(rel)
    except Exception as e:
        print(f"FAIL {rel}: {e}")
