#!/usr/bin/env python3
import ftplib
from pathlib import Path

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"
ROOT = "/www/id.assistix.org"
OUT = Path(__file__).resolve().parent / "_id_site_snap"
OUT.mkdir(parents=True, exist_ok=True)

files = [
    "api/bootstrap-login.php",
    "api/oauth-finish.php",
    "auth/index.html",
    "auth/auth-app.js",
    "auth/index.php",
    "index.html",
    "config.php",
    "config.example.php",
    ".htaccess",
]

# also list api + auth
f = ftplib.FTP()
f.connect(HOST, 21, timeout=40)
f.login(USER, PASS)

def nlst(path):
    f.cwd(path)
    return [n for n in f.nlst() if n not in (".", "..")]

print("api:", nlst(f"{ROOT}/api"))
print("auth:", nlst(f"{ROOT}/auth"))
print("login:", nlst(f"{ROOT}/login") if True else [])

for rel in files:
    remote = f"{ROOT}/{rel}"
    local = OUT / rel.replace("/", "__")
    try:
        with open(local, "wb") as out:
            f.retrbinary(f"RETR {remote}", out.write)
        size = local.stat().st_size
        print(f"OK {rel} ({size} bytes)")
    except Exception as e:
        print(f"FAIL {rel}: {e}")

# list more oauth-ish api files
for name in nlst(f"{ROOT}/api"):
    if any(k in name.lower() for k in ("oauth", "token", "auth", "login", "session", "consent", "authorize")):
        print("API_INTEREST", name)
