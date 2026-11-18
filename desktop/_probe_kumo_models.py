#!/usr/bin/env python3
import json
import urllib.error
import urllib.request

KEY = "YOUR_KUMO_API_KEY_HERE"
TESTS = [
    "deepseek-v4-flash",
    "deepseek-v4-1-flash",
    "gemini-3.8-flash",
    "google/gemini-3.1-flash-lite",
    "google/gemini-3.6-flash-high",
    "qwen3-8-flash",
    "glm-5.3-flash",
    "mimo-v2-6-flash",
    "step-3-7-flash",
    "xai/grok-4.7",
    "xai/grok-4.6",
    "deepseek-v4-pro-0813",
]


def chat(model: str):
    body = json.dumps(
        {
            "model": model,
            "max_tokens": 48,
            "messages": [{"role": "user", "content": "Ответь одним словом: ок"}],
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.kumorouter.com/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            d = json.loads(r.read().decode())
            txt = ((d.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
            return "OK", txt[:80].replace("\n", " "), d.get("usage")
    except urllib.error.HTTPError as e:
        return f"HTTP{e.code}", e.read().decode("utf-8", "replace")[:180], None
    except Exception as e:
        return "ERR", str(e)[:180], None


for m in TESTS:
    st, info, usage = chat(m)
    print(f"{m} => {st} | {info!r} | {usage}")
