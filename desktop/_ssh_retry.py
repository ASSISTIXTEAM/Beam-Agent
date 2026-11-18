import os
import socket
import time
import paramiko

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "YOUR_SSH_PASSWORD_HERE"

def try_paramiko():
    print("=== paramiko ===")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        username=USER,
        password=PASS,
        timeout=45,
        banner_timeout=90,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    stdin, stdout, stderr = c.exec_command(
        "ls -la /var/www/u3354161/data/www | head -80; "
        "ls -la /var/www/u3354161/data/www/id.assistix.org 2>/dev/null | head -40; "
        "ls -la ~/www 2>/dev/null | head -40"
    )
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err:
        print("ERR", err[:800])
    c.close()
    return True

def try_socket_banner():
    print("=== raw banner ===")
    s = socket.create_connection((HOST, 22), timeout=20)
    s.settimeout(20)
    try:
        data = s.recv(256)
        print("banner:", data)
    except Exception as e:
        print("banner fail:", e)
    s.close()

def try_ftp():
    print("=== ftp ===")
    from ftplib import FTP
    ftp = FTP()
    ftp.connect(HOST, 21, timeout=40)
    print("welcome:", ftp.getwelcome())
    ftp.login(USER, "7oQd4Hw2eF1aJ1Cj")
    ftp.set_pasv(True)
    print("pwd", ftp.pwd())
    ftp.retrlines("LIST", lambda line: print(line))
    ftp.quit()
    return True

if __name__ == "__main__":
    try_socket_banner()
    for i in range(3):
        try:
            if try_paramiko():
                break
        except Exception as e:
            print(f"ssh attempt {i+1} failed:", e)
            time.sleep(4)
    try:
        try_ftp()
    except Exception as e:
        print("ftp failed:", e)
