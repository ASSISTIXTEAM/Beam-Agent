#!/usr/bin/env python3
from pathlib import Path

INJECT_AFTER = 'from "electron";'
INJECT = '''from "electron";
/* BEAM_AUMID_EARLY: Windows jump-list / taskbar name — must run before any BrowserWindow */
try {
\tapp.setName("Beam Agent");
\tif (process.platform === "win32") app.setAppUserModelId("Assistix.BeamAgent");
} catch {}
'''

FILES = [
    Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\runtime\app\lib\main.js"),
    Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\dist\Beam Agent\resources\app\lib\main.js"),
]

for p in FILES:
    if not p.exists():
        print("missing", p)
        continue
    t = p.read_text(encoding="utf-8")
    if "BEAM_AUMID_EARLY" in t:
        print("ok", p)
        continue
    if INJECT_AFTER not in t:
        print("needle missing", p)
        continue
    # Only replace the electron import line once
    t2 = t.replace(INJECT_AFTER + "\n", INJECT + "\n", 1)
    if t2 == t:
        t2 = t.replace(INJECT_AFTER + "\r\n", INJECT + "\r\n", 1)
    if t2 == t:
        print("replace failed", p)
        continue
    p.write_text(t2, encoding="utf-8")
    print("patched", p)
