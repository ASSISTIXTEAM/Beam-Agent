#!/usr/bin/env python3
import ftplib
import time
from pathlib import Path

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"
OUT = Path(__file__).resolve().parent / "_id_site_snap" / "lib__clients.php"

for attempt in range(5):
    try:
        f = ftplib.FTP()
        f.connect(HOST, 21, timeout=90)
        f.login(USER, PASS)
        f.set_pasv(True)
        f.voidcmd("TYPE I")
        buf = bytearray()
        f.retrbinary("RETR /www/id.assistix.org/lib/clients.php", buf.extend)
        f.quit()
        OUT.write_bytes(buf)
        print("OK", len(buf))
        print(buf[:400].decode("utf-8", "replace"))
        break
    except Exception as e:
        print(f"attempt {attempt+1} fail: {e}")
        time.sleep(2)
else:
    # try backup extract
    try:
        f = ftplib.FTP()
        f.connect(HOST, 21, timeout=90)
        f.login(USER, PASS)
        f.set_pasv(True)
        for path in [
            "/id_backup_20261105/lib/clients.php",
            "/www/id.assistix.org/lib/clients.php.bak",
        ]:
            try:
                buf = bytearray()
                f.retrbinary(f"RETR {path}", buf.extend)
                OUT.write_bytes(buf)
                print("OK backup", path, len(buf))
                break
            except Exception as e:
                print("no", path, e)
        f.quit()
    except Exception as e:
        print("backup fail", e)
