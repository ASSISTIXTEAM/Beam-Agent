import json
import urllib.request
import urllib.error

tests = [
    ("assistix-chat", "assistix-chat-oauth-local-20260514-do-not-commit-public-repos", "http://127.0.0.1:17865/assistix/callback"),
    ("assistix-chat", "assistix-chat-oauth-local-20260514-do-not-commit-public-repos", "https://chat.assistix.org/auth/callback.php"),
    ("assistix-agent", "assistix-chat-oauth-local-20260514-do-not-commit-public-repos", "https://agent.assistix.org/auth/callback.php"),
]

for client, secret, redirect in tests:
    payload = {
        "code": "invalid-probe-code",
        "client_id": client,
        "client_secret": secret,
        "redirect_uri": redirect,
    }
    req = urllib.request.Request(
        "https://id.assistix.org/api/exchange.php",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8", "replace")
            code = resp.status
    except urllib.error.HTTPError as e:
        code = e.code
        body = e.read().decode("utf-8", "replace")
    print(f"{code} | {client} | {redirect} | {body}")
