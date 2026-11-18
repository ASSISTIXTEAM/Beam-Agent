import urllib.request
import urllib.parse
import urllib.error

# What does oauth-finish do without session?
data = urllib.parse.urlencode({
    "redirect_uri": "http://127.0.0.1:17865/assistix/callback",
    "client_id": "assistix-chat",
    "state": "beam-test",
}).encode()
req = urllib.request.Request(
    "https://id.assistix.org/api/oauth-finish.php",
    data=data,
    method="POST",
    headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "text/html"},
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        print("status", resp.status)
        print("headers", dict(resp.headers))
        print(resp.read()[:500])
except urllib.error.HTTPError as e:
    print("status", e.code)
    print("headers", dict(e.headers))
    print(e.read()[:800].decode("utf-8", "replace"))

# Also GET variant
q = urllib.parse.urlencode({
    "redirect_uri": "http://127.0.0.1:17865/assistix/callback",
    "client_id": "assistix-chat",
    "state": "beam-test",
})
try:
    with urllib.request.urlopen("https://id.assistix.org/api/oauth-finish.php?" + q, timeout=20) as resp:
        print("GET", resp.status, dict(resp.headers).get("Location"), resp.read()[:200])
except urllib.error.HTTPError as e:
    print("GET", e.code, e.headers.get("Location"), e.read()[:400].decode("utf-8", "replace"))
