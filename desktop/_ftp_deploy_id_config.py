#!/usr/bin/env python3
"""Deploy ASSISTIX ID config.local.php (Beam loopback redirects) via FTP."""
from __future__ import annotations

import ftplib
import time
from pathlib import Path

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"
REMOTE = "/www/id.assistix.org/config.local.php"
LOCAL = Path(__file__).resolve().parent / "_id_site_snap" / "config.local.beam.php"
BACKUP = Path(__file__).resolve().parent / "_id_site_snap" / "config.local.php.bak-before-beam-oauth"


def ftp():
    f = ftplib.FTP()
    f.connect(HOST, 21, timeout=60)
    f.login(USER, PASS)
    f.set_pasv(True)
    return f


def main():
    data = LOCAL.read_bytes()
    print("local bytes", len(data))

    # backup current
    for attempt in range(4):
        try:
            f = ftp()
            f.voidcmd("TYPE I")
            buf = bytearray()
            f.retrbinary(f"RETR {REMOTE}", buf.extend)
            BACKUP.write_bytes(buf)
            print("backed up", len(buf), "->", BACKUP.name)
            f.quit()
            break
        except Exception as e:
            print("backup attempt", attempt + 1, e)
            time.sleep(1.5)

    for attempt in range(5):
        try:
            f = ftp()
            f.voidcmd("TYPE I")
            f.storbinary(f"STOR {REMOTE}", open(LOCAL, "rb"))
            # verify
            buf = bytearray()
            f.retrbinary(f"RETR {REMOTE}", buf.extend)
            f.quit()
            text = buf.decode("utf-8", "replace")
            ok = "17865/assistix/callback" in text and "assistix-agent" in text
            print("uploaded verify", len(buf), "loopback_ok=", ok)
            if not ok:
                raise RuntimeError("upload verify failed")
            return
        except Exception as e:
            print("upload attempt", attempt + 1, e)
            time.sleep(2)
    raise SystemExit(1)


if __name__ == "__main__":
    main()
