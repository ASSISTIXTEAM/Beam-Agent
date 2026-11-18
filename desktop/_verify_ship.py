from pathlib import Path

ms = Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\dist\Beam Agent\resources\app\beam\node_modules\@assistix\beam-client-ui-model-selection\lib\client.js")
acc = Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\dist\Beam Agent\resources\app\beam\node_modules\@assistix\beam-llm-deepseek-account\lib\index.js")
br = Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\dist\Beam Agent\bridge\server.js")
html = Path(r"C:\Users\Alexa\OneDrive\Documents\Beam Agent\dist\Beam Agent\resources\app\beam\node_modules\@assistix\beam-web-frontend\dist\index.html")

for label, p, needles in [
    ("model-selection", ms, ["empty.models", "Нет доступных моделей", "No models available", "Выбрать модель", "Select model"]),
    ("account", acc, ["never return empty", "discoverModels"]),
    ("bridge", br, ["deepseek-v4-1-flash", "BEAM_STREAM_FINALLY", "requireAuth(res, state)"]),
    ("html", html, ["beam-locale-bootstrap", "beam-ban-partial-no"]),
]:
    t = p.read_text(encoding="utf-8")
    print("==", label, "==")
    for n in needles:
        print(f"  {n!r}: {t.count(n)}")
    if label == "bridge":
        idx = t.find("/anthropic/v1/models")
        chunk = t[idx : idx + 400]
        print("  models chunk has requireAuth:", "requireAuth(res, state)" in chunk)

cordis = Path.home() / ".beam/profiles/desktop/cordis.patch.yml"
print("cordis locale:", [ln.strip() for ln in cordis.read_text(encoding="utf-8").splitlines() if "preference" in ln or "locale" in ln][:8])
