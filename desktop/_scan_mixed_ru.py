import re
from pathlib import Path

root = Path(r"C:\Beam-Agent\dist\Beam-Agent\resources\app\beam\node_modules\@assistix")
keep = re.compile(r"ASSISTIX|Beam Agent|Tide|Flare|Pine|\bAPI\b|\bURL\b|\bID\b|\bHTTP\b|\bJSON\b|\bOK\b|Email|macOS|Windows|Linux|GitHub")
mixed = []
for f in root.rglob("client.js"):
    if "beam-client" not in str(f):
        continue
    t = f.read_text(encoding="utf-8", errors="replace")
    for m in re.finditer(r"// #region beam-ru([\s\S]*?)// #endregion beam-ru", t):
        block = m.group(1)
        for sm in re.finditer(r'"((?:\\.|[^"\\])*)"', block):
            val = bytes(sm.group(1), "utf-8").decode("unicode_escape") if "\\" in sm.group(1) else sm.group(1)
            if re.search(r"[А-Яа-яЁё]", val) and re.search(r"[A-Za-z]{3,}", val) and not keep.search(val):
                mixed.append((f.parent.parent.name, val[:100]))

print("mixed", len(mixed))
for a, b in mixed[:40]:
    print(f"{a} => {b}")
