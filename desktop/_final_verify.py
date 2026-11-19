from pathlib import Path
import re
import urllib.request

ms = Path(
    r"C:\Beam-Agent\dist\Beam-Agent\resources\app\beam\node_modules\@assistix\beam-client-ui-model-selection\lib\client.js"
).read_text(encoding="utf-8")
acc = Path(
    r"C:\Beam-Agent\dist\Beam-Agent\resources\app\beam\node_modules\@assistix\beam-llm-deepseek-account\lib\index.js"
).read_text(encoding="utf-8")
html = Path(
    r"C:\Beam-Agent\dist\Beam-Agent\resources\app\beam\node_modules\@assistix\beam-web-frontend\dist\index.html"
).read_text(encoding="utf-8")

ru_empty = re.search(r'const ru = \{[\s\S]*?"empty\.models": "([^"]+)"', ms)
en_empty = re.search(r'const en = \{[\s\S]*?"empty\.models": "([^"]+)"', ms)
print("ru empty.models =", ru_empty.group(1) if ru_empty else None)
print("en empty.models =", en_empty.group(1) if en_empty else None)
print("account fallback =", "never return empty" in acc)
print("locale bootstrap =", "beam-locale-bootstrap" in html)
print("partial-no guard =", "beam-ban-partial-no" in html)
print("register en,ru =", "locale.register(NS, { en, ru })" in ms)

try:
    body = urllib.request.urlopen("http://127.0.0.1:17865/models", timeout=5).read().decode()
    print("bridge /models ok", "tide" in body and "flare" in body and "pine" in body, "bytes", len(body))
except Exception as e:
    print("bridge /models FAIL", e)

cordis = Path.home() / ".beam/profiles/desktop/cordis.patch.yml"
print("cordis preference lines:")
for ln in cordis.read_text(encoding="utf-8").splitlines():
    if "preference" in ln or "provider" in ln or "locale" in ln or "assistix" in ln.lower():
        print(" ", ln.strip())
