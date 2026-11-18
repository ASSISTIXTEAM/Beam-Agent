#!/usr/bin/env python3
import json
import urllib.error
import urllib.request

tests = [
    ("GET", "https://agent.assistix.org/api/bootstrap.php", None),
    ("GET", "https://agent.assistix.org/api/chat.php", None),
    ("GET", "https://agent.assistix.org/api/projects.php", None),
    ("POST", "https://agent.assistix.org/api/stream.php", {"message": "hi", "model": "TIDE"}),
]

for method, url, body in tests:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"} if data else {"Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8", "replace")
            print(method, resp.status, url, raw[:220])
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        print(method, e.code, url, raw[:220])
