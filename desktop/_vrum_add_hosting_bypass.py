"""Add Reg.ru hosting to VrumVPN Direct bypass (keep VPN for everything else)."""
from __future__ import annotations

import json
from pathlib import Path

PREFS = Path(r"C:\Users\Alexa\AppData\Roaming\VrumVPN\VrumVPN\shared_preferences.json")
PROFILE = Path(r"C:\Users\Alexa\AppData\Roaming\VrumVPN\profiles\1794081122054.yaml")

ADD_BYPASS = [
    "31.31.196.221",
    "server176.hosting.reg.ru",
    "hosting.reg.ru",
]

ADD_RULES = [
    "IP-CIDR,31.31.196.221/32,DIRECT,no-resolve",
    "DOMAIN-SUFFIX,hosting.reg.ru,DIRECT",
    "DOMAIN,server176.hosting.reg.ru,DIRECT",
]


def main() -> None:
    raw = json.loads(PREFS.read_text(encoding="utf-8"))
    cfg = json.loads(raw["flutter.config"])
    bypass = list(cfg.get("networkProps", {}).get("bypassDomain") or [])
    before = list(bypass)
    for item in ADD_BYPASS:
        if item not in bypass:
            bypass.append(item)
    cfg.setdefault("networkProps", {})["bypassDomain"] = bypass
    raw["flutter.config"] = json.dumps(cfg, ensure_ascii=False, separators=(",", ":"))
    PREFS.write_text(json.dumps(raw, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("bypass added:", [x for x in bypass if x not in before or x in ADD_BYPASS])
    print("bypass now has hosting:", all(x in bypass for x in ADD_BYPASS))

    text = PROFILE.read_text(encoding="utf-8")
    if "rules:" not in text:
        raise SystemExit("no rules: in profile")
    insert = []
    for rule in ADD_RULES:
        if rule not in text:
            insert.append(f"- {rule}")
    if insert:
        # Put hosting DIRECT rules at the very top of rules:
        text = text.replace("rules:\n", "rules:\n" + "\n".join(insert) + "\n", 1)
        PROFILE.write_text(text, encoding="utf-8")
        print("profile rules inserted:", insert)
    else:
        print("profile rules already present")


if __name__ == "__main__":
    main()
