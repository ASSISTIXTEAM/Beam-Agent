#!/usr/bin/env python3
import json
import urllib.error
import urllib.request

KEY = "YOUR_KUMO_API_KEY_HERE"
# Prefer cheap flash models for agent tooling; avoid ones that socket-reset
TESTS = [
    "deepseek-v4-flash",
    "deepseek-v4-1-flash",
    "qwen3-8-flash",
    "glm-5.3-flash",
    "mimo-v2-6-flash",
    "google/gemini-3.1-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "xai/grok-4.6",
    "xai/grok-4.7",
]


def chat(model: str, with_tools: bool = False):
    payload = {
        "model": model,
        "max_tokens": 64,
        "messages": [{"role": "user", "content": "Say OK"}],
    }
    if with_tools:
        payload["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": "ping",
                    "description": "ping tool",
                    "parameters": {"type": "object", "properties": {"x": {"type": "string"}}},
                },
            }
        ]
        payload["tool_choice"] = "auto"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.kumorouter.com/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=70) as r:
            d = json.loads(r.read().decode())
            ch = (d.get("choices") or [{}])[0]
            msg = ch.get("message") or {}
            return "OK", (msg.get("content") or "")[:50], bool(msg.get("tool_calls")), d.get("usage")
    except urllib.error.HTTPError as e:
        return f"HTTP{e.code}", e.read().decode("utf-8", "replace")[:140], False, None
    except Exception as e:
        return "ERR", str(e)[:140], False, None


print("=== plain ===")
for m in TESTS:
    st, txt, tools, usage = chat(m, False)
    print(f"{m}: {st} text={txt!r} usage={usage}")

print("=== with tools ===")
for m in ["deepseek-v4-flash", "qwen3-8-flash", "google/gemini-3.1-flash-lite", "xai/grok-4.7"]:
    st, txt, tools, usage = chat(m, True)
    print(f"{m}: {st} text={txt!r} tools={tools} usage={usage}")
