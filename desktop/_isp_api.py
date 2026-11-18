"""Try ISPmanager HTTP API for file access when SSH/FTP are blocked."""
import json
import ssl
import urllib.parse
import urllib.request

BASE = "https://server176.hosting.reg.ru:1500/ispmgr"
USER = "u3354161"
PASS = "YOUR_SSH_PASSWORD_HERE"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def call(**params):
    params.setdefault("out", "json")
    params["authinfo"] = f"{USER}:{PASS}"
    url = BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=40, context=ctx) as resp:
        raw = resp.read()
        print("HTTP", resp.status, "len", len(raw))
        try:
            return json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            print(raw[:500])
            return None

print("=== whoami / session ===")
for func in ["whoami", "auth", "session.new"]:
    try:
        print(func, call(func=func))
    except Exception as e:
        print(func, "ERR", e)

print("=== file list www ===")
try:
    data = call(func="file", sok="yes", plid="/var/www/u3354161/data/www")
    print(json.dumps(data, ensure_ascii=False)[:2000] if data else None)
except Exception as e:
    print("file ERR", e)

print("=== file list alt ===")
try:
    data = call(func="file", elid="/www")
    print(json.dumps(data, ensure_ascii=False)[:2000] if data else None)
except Exception as e:
    print("file2 ERR", e)
