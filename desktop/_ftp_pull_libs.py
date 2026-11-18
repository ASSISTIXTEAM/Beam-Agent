#!/usr/bin/env python3
import ftplib
from pathlib import Path

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"
ROOT = "/www/id.assistix.org"
OUT = Path(__file__).resolve().parent / "_id_site_snap"
OUT.mkdir(parents=True, exist_ok=True)


def ftp():
    f = ftplib.FTP()
    f.connect(HOST, 21, timeout=45)
    f.login(USER, PASS)
    f.set_pasv(True)
    return f


def list_dir(rel: str):
    f = ftp()
    f.cwd(f"{ROOT}/{rel}")
    names = [n for n in f.nlst() if n not in (".", "..")]
    f.quit()
    print("DIR", rel, names)
    return names


def pull(rel: str):
    local = OUT / rel.replace("/", "__")
    f = ftp()
    f.voidcmd("TYPE I")
    with open(local, "wb") as out:
        f.retrbinary(f"RETR {ROOT}/{rel}", out.write)
    f.quit()
    print("OK", rel, local.stat().st_size)


libs = list_dir("lib")
for name in libs:
    if name.endswith(".php"):
        try:
            pull(f"lib/{name}")
        except Exception as e:
            print("FAIL", name, e)

for rel in [
    "api/oauth/authorize.php",
    "api/oauth/token.php",
    "api/oauth/revoke.php",
]:
    try:
        pull(rel)
    except Exception as e:
        print("FAIL", rel, e)

oauth_names = list_dir("api/oauth")
for name in oauth_names:
    if name.endswith(".php"):
        try:
            pull(f"api/oauth/{name}")
        except Exception as e:
            print("FAIL oauth/", name, e)
