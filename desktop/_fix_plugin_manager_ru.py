#!/usr/bin/env python3
"""Force plugin-manager ru values that still look broken back to en (better than mix)."""
import json
import re
from pathlib import Path

files = [
    Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\dist\Beam Agent\resources\app\beam\node_modules\@assistix\beam-client-ui-plugin-manager\lib\client.js"),
    Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\runtime\app\beam\node_modules\@assistix\beam-client-ui-plugin-manager\lib\client.js"),
]

broken = re.compile(
    r"Поискing|Изменитьing|Нетt |Нет plugins|Нет registry|Нет such|Нет version|Нет write|Нет output|Нет exit|О программе plugins|сейчас version|Нет component|Вкл-demand|Выклicial|Обновление available|Обновление \{|Отменаlat|Отмена install|Отменаled|Стопping|Refresh failed\. Попробуйте|Свернуть output|Развернуть the"
)


def parse_dict(src: str, name: str):
    m = re.search(rf"const {name} = \{{", src)
    if not m:
        return None
    start = src.find("{", m.start())
    depth = 0
    i = start
    while i < len(src):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                i += 1
                break
        i += 1
    block = src[start:i]
    d = {}
    for mm in re.finditer(r'"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"', block):
        d[json.loads(f'"{mm.group(1)}"')] = json.loads(f'"{mm.group(2)}"')
    return d, start, i


for f in files:
    if not f.exists():
        continue
    src = f.read_text(encoding="utf-8")
    en = parse_dict(src, "en")
    ru = parse_dict(src, "ru")
    if not en or not ru:
        print("skip", f)
        continue
    en_d, _, _ = en
    ru_d, a, b = ru
    n = 0
    for k, v in list(ru_d.items()):
        if broken.search(v) or (
            re.search(r"[А-Яа-яЁё]", v)
            and re.search(r"\b(plugins|registry|version|install|output|component|official)\b", v, re.I)
        ):
            if k in en_d:
                ru_d[k] = en_d[k]
                n += 1
    items = list(ru_d.items())
    lines = ["{"]
    for i, (k, v) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        lines.append(f'\t\t\t{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}{comma}')
    lines.append("\t\t}")
    # find const ru prefix
    prefix_start = src.rfind("const ru", 0, a)
    src2 = src[:prefix_start] + "const ru = " + "\n".join(lines) + src[b:]
    f.write_text(src2, encoding="utf-8")
    print("fixed", n, f)
