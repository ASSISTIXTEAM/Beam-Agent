"""Persist hosting Direct rules via VrumVPN profile override + bypassDomain."""
from __future__ import annotations

import json
import uuid
from pathlib import Path

PREFS = Path(r"C:\Users\Alexa\AppData\Roaming\VrumVPN\VrumVPN\shared_preferences.json")
PROFILE = Path(r"C:\Users\Alexa\AppData\Roaming\VrumVPN\profiles\1794081122054.yaml")

HOSTING_RULE_VALUES = [
    "IP-CIDR,31.31.196.221/32,DIRECT,no-resolve",
    "DOMAIN-SUFFIX,hosting.reg.ru,DIRECT",
    "DOMAIN,server176.hosting.reg.ru,DIRECT",
]

ADD_BYPASS = [
    "31.31.196.221",
    "server176.hosting.reg.ru",
    "hosting.reg.ru",
]


def main() -> None:
    raw = json.loads(PREFS.read_text(encoding="utf-8"))
    cfg = json.loads(raw["flutter.config"])

    bypass = list(cfg.get("networkProps", {}).get("bypassDomain") or [])
    for item in ADD_BYPASS:
        if item not in bypass:
            bypass.append(item)
    cfg.setdefault("networkProps", {})["bypassDomain"] = bypass

    profiles = cfg.get("profiles") or []
    for p in profiles:
        if p.get("id") != "1794081122054":
            continue
        od = p.get("overrideData") or {}
        od["enable"] = True
        rule = od.get("rule") or {"type": "added", "overrideRules": [], "addedRules": []}
        rule["type"] = "added"
        added = list(rule.get("addedRules") or [])
        existing_values = {
            (x.get("value") if isinstance(x, dict) else str(x)) for x in added
        }
        for value in reversed(HOSTING_RULE_VALUES):
            if value in existing_values:
                continue
            added.insert(0, {"id": str(uuid.uuid4()), "value": value})
        rule["addedRules"] = added
        rule.setdefault("overrideRules", [])
        od["rule"] = rule
        p["overrideData"] = od
        print("override profile", p.get("label"), "addedRules=", len(added))

    raw["flutter.config"] = json.dumps(cfg, ensure_ascii=False, separators=(",", ":"))
    PREFS.write_text(json.dumps(raw, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Keep live profile yaml aligned until app regenerates it
    text = PROFILE.read_text(encoding="utf-8")
    insert = [f"- {v}" for v in HOSTING_RULE_VALUES if v not in text]
    if insert:
        text = text.replace("rules:\n", "rules:\n" + "\n".join(insert) + "\n", 1)
        PROFILE.write_text(text, encoding="utf-8")
        print("yaml rules:", insert)
    print("ok")


if __name__ == "__main__":
    main()
