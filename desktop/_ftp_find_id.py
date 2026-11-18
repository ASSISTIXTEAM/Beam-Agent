#!/usr/bin/env python3
import ftplib

HOST = "31.31.196.221"
USER = "u3354161"
PASS = "7oQd4Hw2eF1aJ1Cj"

f = ftplib.FTP()
f.connect(HOST, 21, timeout=30)
f.login(USER, PASS)
print("pwd", f.pwd())
print("root", f.nlst())

for p in [
    "/www",
    "/www/id.assistix.org",
    "/www/chat.assistix.org",
    "/www/agent.assistix.org",
    "/www/assistix.org",
]:
    try:
        f.cwd(p)
        names = f.nlst()
        print("OK", p, "count=", len(names), "sample=", names[:25])
    except Exception as e:
        print("NO", p, type(e).__name__, e)

# dig www for assistix
try:
    f.cwd("/www")
    for n in f.nlst():
        if "assistix" in n.lower() or n.lower().startswith("id"):
            print("SITE", n)
except Exception as e:
    print("www dig fail", e)
