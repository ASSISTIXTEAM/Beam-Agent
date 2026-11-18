import paramiko
import socket

sock = socket.create_connection(("31.31.196.221", 22), timeout=20)
print("socket ok", sock.getpeername())

t = paramiko.Transport(sock)
t.banner_timeout = 60
t.auth_timeout = 60
t.connect(username="u3354161", password="YOUR_SSH_PASSWORD_HERE")
print("transport ok")
chan = t.open_session(timeout=30)
chan.exec_command("ls -la ~/www; ls -la ~ | head -40; find ~/www -maxdepth 3 -type d 2>/dev/null | head -80")
out = b""
while True:
    if chan.recv_ready():
        out += chan.recv(65535)
    elif chan.exit_status_ready():
        while chan.recv_ready():
            out += chan.recv(65535)
        break
print(out.decode("utf-8", "replace"))
t.close()
