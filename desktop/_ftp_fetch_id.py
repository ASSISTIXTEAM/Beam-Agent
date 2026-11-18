#!/usr/bin/env python3
from ftplib import FTP
from io import BytesIO

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"
ROOTS = [
    "/var/www/u3354161/data/www/id.assistix.org",
    "/home/u3354161/www/id.assistix.org",
    "www/id.assistix.org",
    "/www/id.assistix.org",
]

def try_get(ftp, path):
    bio = BytesIO()
    try:
        ftp.retrbinary(f"RETR {path}", bio.write)
        return bio.getvalue()
    except Exception as e:
        return None

ftp = FTP()
ftp.connect(HOST, 21, timeout=25)
ftp.login(USER, PASS)
print("PWD", ftp.pwd())
try:
    print("NLST", ftp.nlst()[:30])
except Exception as e:
    print("NLST err", e)

for root in ROOTS:
    for rel in ["api/login-actions.php", "api/oauth-finish.php", "api/bootstrap-login.php"]:
        path = f"{root.rstrip('/')}/{rel}"
        data = try_get(ftp, path)
        if data:
            out = f"desktop/_id_src_{rel.replace('/', '_')}"
            open(out, "wb").write(data)
            print("OK", path, "->", out, "bytes", len(data))
        else:
            print("MISS", path)

# also try relative
for rel in ["api/login-actions.php", "www/id.assistix.org/api/login-actions.php", "id.assistix.org/api/login-actions.php"]:
    data = try_get(ftp, rel)
    print("REL", rel, "OK" if data else "MISS", len(data or b""))
    if data:
        open("desktop/_id_src_login-actions.php", "wb").write(data)

ftp.quit()
print("done")
