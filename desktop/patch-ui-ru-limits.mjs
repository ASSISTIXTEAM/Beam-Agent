/**
 * Beam Agent UI: full RU locale, Limits (Tide/Flare/Pine) instead of Models chrome,
 * sidebar usage panel like assistix-chat, fix double/black logos.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const APP = path.join(ROOT, "dist/Beam-Agent/resources/app");
const DSH = path.join(APP, "dsh/node_modules/@deepseek-ai");
const WEB = path.join(APP, "dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist");
const ASSETS = path.join(WEB, "assets");

const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const LOGO_TEAL = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(logoSvg);

/** Phrase map — longer phrases first. Applied to dictionary string values. */
const PHRASES = [
  ["Open configuration file", "Открыть файл конфигурации"],
  ["Could not open configuration file", "Не удалось открыть файл конфигурации"],
  ["Built-in plugins", "Встроенные плагины"],
  ["Agent presets", "Пресеты агента"],
  ["Sign in with ASSISTIX ID to use Tide, Flare and Pine", "Войдите через ASSISTIX ID, чтобы использовать Tide, Flare и Pine"],
  ["Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed.", "Модели Beam Agent — Tide, Flare и Pine. Доступ через ASSISTIX ID, ключи API не нужны."],
  ["Connected via ASSISTIX", "Подключено через ASSISTIX"],
  ["Sign in with ASSISTIX ID", "Войти через ASSISTIX ID"],
  ["ASSISTIX ID", "ASSISTIX ID"],
  ["Current version:", "Текущая версия:"],
  ["Show coding view", "Показать вид кодирования"],
  ["Shows trajectory, code diffs, and all Agent presets", "Показывает траекторию, диффы кода и все пресеты агента"],
  ["Could not save. Please try again.", "Не удалось сохранить. Попробуйте ещё раз."],
  ["Checking for updates…", "Проверка обновлений…"],
  ["Install and Restart", "Установить и перезапустить"],
  ["Retry update", "Повторить обновление"],
  ["Language", "Язык"],
  ["Settings", "Настройки"],
  ["General", "Общие"],
  ["Models", "Лимиты"],
  ["Edit", "Изменить"],
  ["Delete", "Удалить"],
  ["Close", "Закрыть"],
  ["Cancel", "Отмена"],
  ["Apply", "Применить"],
  ["Applying…", "Применение…"],
  ["Retry", "Повторить"],
  ["Loading…", "Загрузка…"],
  ["Connected", "Подключено"],
  ["Disconnected", "Отключено"],
  ["Reconnecting", "Переподключение"],
  ["New session", "Новая сессия"],
  ["New chat", "Новый чат"],
  ["Search", "Поиск"],
  ["Send", "Отправить"],
  ["Stop", "Стоп"],
  ["Copy", "Копировать"],
  ["Copied", "Скопировано"],
  ["Collapse", "Свернуть"],
  ["Expand", "Развернуть"],
  ["Back", "Назад"],
  ["Next", "Далее"],
  ["Previous", "Назад"],
  ["Save", "Сохранить"],
  ["Skip", "Пропустить"],
  ["More", "Ещё"],
  ["Unknown", "Неизвестно"],
  ["None", "Нет"],
  ["Update", "Обновление"],
  ["Workspace", "Рабочая область"],
  ["Sessions", "Сессии"],
  ["Files", "Файлы"],
  ["Terminal", "Терминал"],
  ["Browser", "Браузер"],
  ["Plan", "План"],
  ["Goals", "Цели"],
  ["Permissions", "Разрешения"],
  ["Shortcuts", "Горячие клавиши"],
  ["Plugins", "Плагины"],
  ["Account", "Аккаунт"],
  ["Signed in", "Вы вошли"],
  ["Sign in", "Войти"],
  ["Sign out", "Выйти"],
  ["Provider", "Провайдер"],
  ["API key", "Ключ API"],
  ["Base URL", "Базовый URL"],
  ["Display name", "Отображаемое имя"],
  ["Context window", "Контекст"],
  ["Max output tokens", "Макс. токенов ответа"],
  ["Reasoning levels", "Уровни рассуждения"],
  ["Add model", "Добавить модель"],
  ["Delete model", "Удалить модель"],
  ["Restore defaults", "Сбросить по умолчанию"],
  ["Not now", "Не сейчас"],
  ["Reload to load the new version", "Перезагрузить, чтобы применить новую версию"],
  ["Service version changed", "Версия сервиса изменилась"],
  ["Overridden", "Переопределено"],
  ["Enabled", "Включено"],
  ["Disabled", "Выключено"],
  ["On", "Вкл"],
  ["Off", "Выкл"],
  ["Yes", "Да"],
  ["No", "Нет"],
  ["OK", "OK"],
  ["Error", "Ошибка"],
  ["Warning", "Предупреждение"],
  ["Help", "Справка"],
  ["About", "О программе"],
  ["Theme", "Тема"],
  ["Dark", "Тёмная"],
  ["Light", "Светлая"],
  ["System", "Системная"],
  ["English", "English"],
  ["Russian", "Русский"],
  ["Please try again", "Попробуйте ещё раз"],
  ["Please try again later", "Попробуйте позже"],
  ["Check your connection and try again", "Проверьте соединение и попробуйте снова"],
  ["Could not check for updates", "Не удалось проверить обновления"],
  ["Could not download the update", "Не удалось скачать обновление"],
  ["Could not install the update", "Не удалось установить обновление"],
  ["Downloading update", "Скачивание обновления"],
  ["Target version", "Целевая версия"],
  ["Verifying update files…", "Проверка файлов обновления…"],
  ["Preparing to restart…", "Подготовка к перезапуску…"],
  ["Add an API key to get started", "Войдите через ASSISTIX ID"],
  ["Enter your API keys to use models from the following providers.", "Лимиты моделей Tide, Flare и Pine."],
  ["Third-party model provider", "Сторонний провайдер"],
  ["Custom model API", "Свой API моделей"],
  ["Beam Agent", "Beam Agent"],
  ["Tide", "Tide"],
  ["Flare", "Flare"],
  ["Pine", "Pine"],
];

function translateValue(v) {
  if (typeof v !== "string") return v;
  let s = v;
  for (const [en, ru] of PHRASES) {
    if (s.includes(en)) s = s.split(en).join(ru);
  }
  return s;
}

function translateDict(en) {
  const ru = {};
  for (const [k, v] of Object.entries(en)) ru[k] = translateValue(v);
  return ru;
}

function extractObjectLiteral(src, startIdx) {
  // startIdx points at '{'
  let i = startIdx;
  let depth = 0;
  let inStr = null;
  let esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
}

function parseEnDict(literal) {
  // Evaluate as JS object in a sandbox-ish way
  try {
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${literal});`)();
  } catch {
    return null;
  }
}

console.log("1) Inject RU dictionaries into all UI locale.register(en/zh) packs");
{
  const pkgs = fs
    .readdirSync(DSH, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("dsh-client"))
    .map((d) => path.join(DSH, d.name, "lib", "client.js"))
    .filter((p) => fs.existsSync(p));

  let patched = 0;
  for (const file of pkgs) {
    let s = fs.readFileSync(file, "utf8");
    const orig = s;

    // Remove prior beam-ru injections
    s = s.replace(/\n\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru\n/g, "\n");

    // Find `const en = {` or `const en$N = {` near locale dictionaries — prefer ones registered with zh
    // Strategy: for each `locale.register(X, { zh, en` or `{ en, zh` → add ru
    const registerRe = /locale\.register\(([^,]+),\s*\{([^}]*)\}\)/g;
    let m;
    const replacements = [];
    while ((m = registerRe.exec(s))) {
      const inner = m[2];
      if (!/\ben\b/.test(inner)) continue;
      if (/\bru\b/.test(inner)) continue;
      let nextInner = inner
        .replace(/\bzh\s*,\s*/g, "")
        .replace(/,\s*zh\b/g, "")
        .replace(/\bzh\b/g, "");
      if (!/\bru\b/.test(nextInner)) {
        // insert ru next to en
        if (/\ben\b/.test(nextInner)) nextInner = nextInner.replace(/\ben\b/, "en, ru");
        else nextInner = "en, ru";
      }
      // cleanup double commas
      nextInner = nextInner.replace(/,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "").trim();
      replacements.push({ from: m[0], to: `locale.register(${m[1]}, { ${nextInner} })` });
    }
    for (const r of replacements) s = s.split(r.from).join(r.to);

    // Build ru consts from en consts: find `const en = {` blocks that are large locale dicts
    // Insert `const ru = {...}` before each locale.register that now needs ru
    // Simpler: after all `const en = { ... };` that appear before a register, add ru clone once per file if missing
    if (!s.includes("// #region beam-ru") && /locale\.register\([^)]*\bru\b/.test(s)) {
      // Find last `const en = {` or first substantial en dict before register
      const enMatches = [...s.matchAll(/const (en(?:\$\d+)?)\s*=\s*\{/g)];
      const inserts = [];
      for (const em of enMatches) {
        const name = em[1];
        const ruName = name.replace(/^en/, "ru");
        if (s.includes(`const ${ruName} =`)) continue;
        const lit = extractObjectLiteral(s, em.index + em[0].length - 1);
        if (!lit || lit.length < 20) continue;
        const obj = parseEnDict(lit);
        if (!obj || typeof obj !== "object") continue;
        // Heuristic: only translate dicts that look like UI copy (have string values)
        const vals = Object.values(obj);
        if (!vals.length || !vals.every((v) => typeof v === "string")) continue;
        const ruObj = translateDict(obj);
        // Special overrides for models section
        if (ruObj.nav === "Лимиты" || obj.nav === "Models") {
          ruObj.nav = "Лимиты";
          ruObj.title = "Лимиты";
          ruObj.intro =
            "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны.";
          ruObj.models = "Модели";
        }
        if (obj.nav === "Built-in plugins") {
          ruObj.nav = "Встроенные плагины";
          ruObj.title = "Встроенные плагины";
        }
        if (obj.nav === "Agent presets") {
          ruObj.nav = "Пресеты агента";
          ruObj.title = "Пресеты агента";
        }
        if (obj["general.nav"] === "General" || obj["general.nav"]) {
          ruObj["general.nav"] = "Общие";
        }
        if (obj.trigger === "Settings") ruObj.trigger = "Настройки";
        if (obj.title === "Settings") ruObj.title = "Настройки";
        if (obj["language.title"] === "Language") ruObj["language.title"] = "Язык";

        const json = JSON.stringify(ruObj, null, "\t\t\t");
        inserts.push({
          after: em.index + em[0].length - 1 + lit.length,
          text: `\n\t\t// #region beam-ru\n\t\tconst ${ruName} = ${json};\n\t\t// #endregion beam-ru`,
        });
      }
      // apply inserts from end
      inserts.sort((a, b) => b.after - a.after);
      for (const ins of inserts) {
        s = s.slice(0, ins.after) + ";" + ins.text + s.slice(ins.after);
        // we may have doubled `;;` if literal ended and next was `;` — fix
      }
      s = s.replace(/;\s*;\s*\/\/ #region beam-ru/g, ";\n\t\t// #region beam-ru");
    }

    if (s !== orig) {
      fs.writeFileSync(file, s);
      patched++;
    }
  }
  console.log("  patched packages:", patched);
}

console.log("2) Settings-models EN → Limits copy");
{
  const p = path.join(DSH, "dsh-client-ui-settings-models/lib/client.js");
  let s = fs.readFileSync(p, "utf8");
  const pairs = [
    ['nav: "Models"', 'nav: "Limits"'],
    ['nav: "Лимиты"', 'nav: "Limits"'],
    ['title: "Models"', 'title: "Limits"'],
    [
      'intro: "Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed."',
      'intro: "Weekly limits for Tide, Flare and Pine. ASSISTIX ID handles access — no API keys."',
    ],
    ['edit: "Edit"', 'edit: "Details"'],
  ];
  for (const [a, b] of pairs) s = s.split(a).join(b);
  // Ensure Limits phrases in PHRASES work for RU clone — re-run translate on ru if present
  fs.writeFileSync(p, s);
}

console.log("3) Brand-official: teal mark + text name (no double logo)");
{
  const p = path.join(DSH, "dsh-client-ui-brand-official/lib/client.js");
  const client = `window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-brand-official",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		const MARK = ${JSON.stringify(LOGO_TEAL)};
		function OfficialBrandMark({ size }) {
			const s = size || 24;
			return (0, react_jsx_runtime.jsx)("img", {
				src: MARK,
				alt: "Beam",
				width: s,
				height: Math.round(s * 1.038),
				draggable: false,
				style: { display: "block", flexShrink: 0 }
			});
		}
		function OfficialBrandName() {
			return (0, react_jsx_runtime.jsx)("span", {
				style: {
					display: "inline-block",
					fontFamily: '"Savona", "Segoe UI", system-ui, sans-serif',
					fontWeight: 700,
					fontSize: 15,
					lineHeight: "24px",
					letterSpacing: "-0.02em",
					color: "#e8f7f5",
					whiteSpace: "nowrap"
				},
				children: "Beam Agent"
			});
		}
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", function* () {
				yield ctx.slots.register({ name: "sidebar.brand.mark" }, OfficialBrandMark);
				yield ctx.slots.register({ name: "sidebar.brand.name" }, OfficialBrandName);
			}));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
`;
  fs.writeFileSync(p, client);
  console.log("  brand-official rewritten");
}

console.log("4) CSS + injector: sidebar limits, models cards, logo fixes, RU rewrite");
{
  const css = `/* ===== BEAM AGENT — Assistix UI system ===== */
:root {
  --beam: #00B3BC;
  --beam-bright: #2dd4bf;
  --beam-deep: #0d9488;
  --beam-ink: #e8f7f5;
  --beam-muted: #9ec9c3;
  --beam-bg: #041210;
  --beam-surface: #0a1917;
  --beam-elev: #102220;
  --beam-line: #1a3a36;
  --dsw-alias-brand-primary: var(--beam) !important;
  --dsw-alias-button-primary-fill: var(--beam) !important;
  --dsw-alias-button-primary-hover: var(--beam-deep) !important;
  --dsw-alias-state-business-primary: var(--beam) !important;
  --dsw-alias-link: var(--beam-bright) !important;
  --dsw-focus-ring-color: var(--beam) !important;
  --dsw-static-deepseek-500: var(--beam) !important;
  --dsw-static-deepseek-450: var(--beam-bright) !important;
  --dsw-static-deepseek-400: var(--beam-bright) !important;
}
html, body, #root {
  background:
    radial-gradient(1000px 560px at -8% -20%, rgba(0,179,188,.18), transparent 58%),
    radial-gradient(820px 480px at 108% -5%, rgba(45,212,191,.08), transparent 52%),
    var(--beam-bg) !important;
  color: var(--beam-ink) !important;
  color-scheme: dark !important;
}
body[data-ds-dark-theme], :root[data-theme="dark"], html.dark {
  --dsw-alias-bg-base: var(--beam-bg) !important;
  --dsw-alias-bg-layer-1: var(--beam-surface) !important;
  --dsw-alias-bg-layer-2: var(--beam-elev) !important;
  --dsw-alias-bg-layer-3: #142b28 !important;
  --dsw-alias-border-l1: var(--beam-line) !important;
  --dsw-alias-label-primary: var(--beam-ink) !important;
  --dsw-alias-label-secondary: var(--beam-muted) !important;
  --dsw-alias-label-tertiary: #7aaba4 !important;
  --dsw-alias-interactive-bg-hover: rgba(0,179,188,.12) !important;
  --dsw-menu-surface-fill: rgba(10,25,23,.94) !important;
}

/* Single teal mark — never black, never double wordmark-with-mark */
[class*="brandMark"] img,
[class*="railMark"] img,
img[alt="Beam"] {
  filter: none !important;
  opacity: 1 !important;
  color: #00B3BC !important;
}
[class*="brandName"] img { display: none !important; }
[class*="logoRow"] svg {
  /* legacy fish/svg fallback → teal mask once, only if no img sibling */
  width: 24px !important; height: 25px !important;
  color: #00B3BC !important; background: #00B3BC !important;
  -webkit-mask: url("${LOGO_TEAL}") center / contain no-repeat !important;
  mask: url("${LOGO_TEAL}") center / contain no-repeat !important;
}
[class*="logoRow"] svg * { opacity: 0 !important; }
[class*="brandMark"] svg { display: none !important; }
[class*="brandIdentity"]:has(img[alt="Beam"]) svg { display: none !important; }

[class*="_primary_"], button[data-variant="primary"] {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e) !important;
  color: #042f2e !important; border: none !important;
}
::selection { background: rgba(45,212,191,.35) !important; }

[class*="addBlock"], [class*="AddBlock"],
button[aria-label*="Custom model" i],
button[aria-label*="Add model provider" i],
button[aria-label*="Third-party" i] { display: none !important; }

/* Kill old floating BR profile */
#beam-assistix-profile { display: none !important; }

/* Sidebar foot — Assistix-style limits */
[class*="wtg9ga_root"], [class*="_root_"]:has([class*="logoRow"]) {
  position: relative;
}
#beam-side-limits {
  margin-top: auto;
  margin-bottom: 8px;
  padding: 10px 10px 12px;
  border-radius: 14px;
  background: rgba(10, 25, 23, 0.92);
  border: 1px solid rgba(0,179,188,.28);
  box-shadow: 0 1px 0 rgba(255,255,255,.04);
  color: var(--beam-ink);
  font-family: "Savona", "Segoe UI", system-ui, sans-serif;
  flex-shrink: 0;
}
#beam-side-limits .bsl-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; margin-bottom: 10px;
}
#beam-side-limits .bsl-title {
  font-size: 11px; font-weight: 800; letter-spacing: .04em;
  text-transform: uppercase; color: var(--beam-muted);
}
#beam-side-limits .bsl-user {
  font-size: 10px; color: var(--beam-bright);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;
}
#beam-side-limits .bsl-rings {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px;
}
#beam-side-limits .bsl-ring {
  display: flex; align-items: center; gap: 8px; min-width: 0;
}
#beam-side-limits .bsl-ring[data-id="tide"] { grid-column: 1 / -1; }
#beam-side-limits .bsl-chart {
  position: relative; width: 40px; height: 40px; flex-shrink: 0;
}
#beam-side-limits .bsl-chart svg { display: block; width: 40px; height: 40px; }
#beam-side-limits .bsl-pct {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 9px; font-weight: 800; color: var(--beam-ink);
}
#beam-side-limits .bsl-meta { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
#beam-side-limits .bsl-label { font-size: 11px; font-weight: 800; color: var(--beam-ink); }
#beam-side-limits .bsl-val { font-size: 10px; color: var(--beam-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#beam-side-limits .bsl-actions { display: flex; gap: 6px; margin-top: 10px; }
#beam-side-limits .bsl-actions button {
  flex: 1; border: 0; border-radius: 10px; padding: 7px 8px;
  font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit;
}
#beam-side-limits .bsl-primary {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e); color: #042f2e;
}
#beam-side-limits .bsl-ghost {
  background: transparent; color: var(--beam-ink);
  border: 1px solid var(--beam-line) !important;
}

/* Settings Limits page — 3 model cards */
#beam-limits-panel {
  display: grid; gap: 10px; margin-top: 14px;
  font-family: "Savona", "Segoe UI", system-ui, sans-serif;
}
#beam-limits-panel .blp-card {
  border: 1px solid rgba(0,179,188,.28);
  background: linear-gradient(160deg, rgba(16,34,32,.95), rgba(10,25,23,.98));
  border-radius: 14px; padding: 14px 16px;
}
#beam-limits-panel .blp-top {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
#beam-limits-panel .blp-name {
  font-size: 15px; font-weight: 800; color: var(--beam-ink);
  display: flex; align-items: center; gap: 8px;
}
#beam-limits-panel .blp-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #2dd4bf; box-shadow: 0 0 0 3px rgba(45,212,191,.18);
}
#beam-limits-panel .blp-tag {
  font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
  color: var(--beam-bright); opacity: .9;
}
#beam-limits-panel .blp-desc {
  margin: 6px 0 10px; font-size: 12px; color: var(--beam-muted); line-height: 1.4;
}
#beam-limits-panel .blp-row {
  display: flex; justify-content: space-between; font-size: 12px; color: var(--beam-ink);
}
#beam-limits-panel .blp-bar {
  margin-top: 6px; height: 6px; border-radius: 99px;
  background: rgba(255,255,255,.08); overflow: hidden;
}
#beam-limits-panel .blp-bar > span {
  display: block; height: 100%; border-radius: inherit;
  background: linear-gradient(90deg, #2dd4bf, #00B3BC);
}

/* Hide stock provider Edit row when our panel is present */
body:has(#beam-limits-panel) [class*="rowCard"]:has(button),
body:has(#beam-limits-panel) [class*="rows"] > li { display: none !important; }
`;

  fs.writeFileSync(path.join(ASSETS, "beam-override.css"), css);

  let html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  html = html.replace(/<title>[^<]*<\/title>/, "<title>Beam Agent</title>");
  html = html.replaceAll("DeepSeek Harness", "Beam Agent");

  const inject = `
<link rel="stylesheet" href="./assets/beam-override.css">
<script>
(() => {
  const BRIDGE = "http://127.0.0.1:17865";
  const LOGO = ${JSON.stringify(LOGO_TEAL)};
  let scheduled = false, running = false, lastData = null;

  const isRu = () => {
    const lang = (document.documentElement.lang || "").toLowerCase();
    if (lang.startsWith("ru")) return true;
    try {
      const raw = localStorage.getItem("dsh") || localStorage.getItem("locale") || "";
      if (/["']ru["']|"preference"\\s*:\\s*"ru"/.test(raw)) return true;
    } catch {}
    // settings language row selected
    const sel = document.querySelector('[aria-checked="true"], [data-state="checked"]');
    if (sel && /Русский|Russian/i.test(sel.textContent || "")) return true;
    return /\\bРусский\\b/.test(document.body?.innerText?.slice(0, 2500) || "");
  };

  const T = {
    en: {
      limits: "Weekly limits", limitsPage: "Limits",
      guest: "Guest", signInHint: "Sign in for full limits",
      login: "Sign in", logout: "Sign out", refresh: "Refresh",
      tideTag: "Fast", flareTag: "Style", pineTag: "Precise",
      tideDesc: "Everyday thinking — quick tasks and coding.",
      flareDesc: "Style & creative — writing, polish, ideation.",
      pineDesc: "Precision — harder problems, longer context.",
      usedOf: (a,b) => a + " / " + b,
    },
    ru: {
      limits: "Лимиты недели", limitsPage: "Лимиты",
      guest: "Гость", signInHint: "Войдите, чтобы открыть лимиты",
      login: "Войти", logout: "Выйти", refresh: "Обновить",
      tideTag: "Быстрая", flareTag: "Стиль", pineTag: "Точная",
      tideDesc: "Повседневное мышление — быстрые задачи и код.",
      flareDesc: "Стиль и креатив — тексты, полировка, идеи.",
      pineDesc: "Точность — сложные задачи и длинный контекст.",
      usedOf: (a,b) => a + " / " + b,
    }
  };
  const t = () => (isRu() ? T.ru : T.en);

  const RU_DOM = [
    ["Open configuration file", "Открыть файл конфигурации"],
    ["Built-in plugins", "Встроенные плагины"],
    ["Agent presets", "Пресеты агента"],
    ["General", "Общие"],
    ["Limits", "Лимиты"],
    ["Models", "Лимиты"],
    ["Settings", "Настройки"],
    ["Language", "Язык"],
    ["Edit", "Изменить"],
    ["Details", "Подробнее"],
    ["Close", "Закрыть"],
    ["Cancel", "Отмена"],
    ["New session", "Новая сессия"],
    ["Search", "Поиск"],
    ["Connected via ASSISTIX", "Подключено через ASSISTIX"],
    ["Sign in with ASSISTIX ID", "Войти через ASSISTIX ID"],
    ["Weekly limits for Tide, Flare and Pine. ASSISTIX ID handles access — no API keys.",
      "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны."],
    ["Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed.",
      "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны."],
    ["DeepSeek Harness", "Beam Agent"],
    ["DeepSeek", "Beam"],
    ["Harness", "Beam"],
  ];

  const fmt = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + "K";
    return String(n);
  };

  const modelsFrom = (data) => {
    const q = data?.quotas || {};
    return [
      { id: "tide", name: "Tide", limit: q.tide?.limit || 1e6, used: q.tide?.used || 0, color: "#f97316" },
      { id: "flare", name: "Flare", limit: q.flare?.limit || 5e5, used: q.flare?.used || 0, color: "#a78bfa" },
      { id: "pine", name: "Pine", limit: q.pine?.limit || 1e4, used: q.pine?.used || 0, color: "#34d399" },
    ];
  };

  const ringSvg = (pct, color) => {
    const r = 16, c = 2 * Math.PI * r;
    const dash = Math.max(0, Math.min(100, pct)) / 100 * c;
    return \`<svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="\${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="4"/>
      <circle cx="20" cy="20" r="\${r}" fill="none" stroke="\${color}" stroke-width="4"
        stroke-linecap="round" transform="rotate(-90 20 20)"
        stroke-dasharray="\${dash} \${c}"/>
    </svg>\`;
  };

  const findSidebarRoot = () => {
    const logo = document.querySelector('[class*="logoRow"]');
    return logo?.closest('[class*="root"]') || null;
  };

  const ensureSideLimits = () => {
    const root = findSidebarRoot();
    if (!root) return null;
    let el = document.getElementById("beam-side-limits");
    if (!el) {
      el = document.createElement("div");
      el.id = "beam-side-limits";
      root.appendChild(el);
    } else if (el.parentElement !== root) {
      root.appendChild(el);
    }
    return el;
  };

  const renderSide = (data) => {
    const el = ensureSideLimits();
    if (!el) return;
    const tr = t();
    const user = data?.user;
    const signed = !!data?.signedIn && !!user;
    const models = modelsFrom(data);
    const rings = models.map((m) => {
      const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
      return \`<div class="bsl-ring" data-id="\${m.id}">
        <div class="bsl-chart">\${ringSvg(pct, m.color)}<div class="bsl-pct">\${pct}%</div></div>
        <div class="bsl-meta">
          <div class="bsl-label">\${m.name}</div>
          <div class="bsl-val">\${tr.usedOf(fmt(m.used), fmt(m.limit))}</div>
        </div>
      </div>\`;
    }).join("");
    el.innerHTML = \`
      <div class="bsl-head">
        <span class="bsl-title">\${tr.limits}</span>
        <span class="bsl-user">\${signed ? (user.name || user.email || "ASSISTIX") : tr.guest}</span>
      </div>
      <div class="bsl-rings">\${rings}</div>
      <div class="bsl-actions">
        \${signed
          ? \`<button class="bsl-ghost" type="button" data-act="logout">\${tr.logout}</button>
             <button class="bsl-primary" type="button" data-act="refresh">\${tr.refresh}</button>\`
          : \`<button class="bsl-primary" type="button" data-act="login">\${tr.login}</button>\`}
      </div>\`;
    el.querySelector('[data-act="login"]')?.addEventListener("click", () => window.open(BRIDGE + "/assistix/login", "_blank"));
    el.querySelector('[data-act="logout"]')?.addEventListener("click", async () => {
      await fetch(BRIDGE + "/assistix/logout", { method: "POST" }); refresh();
    });
    el.querySelector('[data-act="refresh"]')?.addEventListener("click", () => refresh());
  };

  const enhanceLimitsPage = (data) => {
    // Detect Limits/Models settings content
    const headings = [...document.querySelectorAll("h1,h2,p,[class*='title'],[class*='intro']")];
    const hit = headings.find((h) => /^(Limits|Лимиты|Models|Модели)$/i.test((h.textContent || "").trim())
      || /Tide, Flare|Tide, Flare и Pine|Weekly limits for Tide|Недельные лимиты/i.test(h.textContent || ""));
    if (!hit) {
      document.getElementById("beam-limits-panel")?.remove();
      return;
    }
    const host = hit.closest("section, [class*='section'], [class*='content'], main, div") || hit.parentElement;
    if (!host) return;
    let panel = document.getElementById("beam-limits-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "beam-limits-panel";
      host.appendChild(panel);
    }
    const tr = t();
    const meta = {
      tide: { tag: tr.tideTag, desc: tr.tideDesc },
      flare: { tag: tr.flareTag, desc: tr.flareDesc },
      pine: { tag: tr.pineTag, desc: tr.pineDesc },
    };
    panel.innerHTML = modelsFrom(data).map((m) => {
      const pct = Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
      const info = meta[m.id];
      return \`<div class="blp-card">
        <div class="blp-top">
          <div class="blp-name"><span class="blp-dot" style="background:\${m.color};box-shadow:0 0 0 3px \${m.color}33"></span>\${m.name}</div>
          <div class="blp-tag">\${info.tag}</div>
        </div>
        <div class="blp-desc">\${info.desc}</div>
        <div class="blp-row"><span>\${tr.limits}</span><span>\${tr.usedOf(fmt(m.used), fmt(m.limit))}</span></div>
        <div class="blp-bar"><span style="width:\${pct}%;background:linear-gradient(90deg,\${m.color},#00B3BC)"></span></div>
      </div>\`;
    }).join("");
  };

  const rewriteText = (root) => {
    const ru = isRu();
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      let v = n.nodeValue;
      if (!v) continue;
      if (n.parentElement?.closest?.("#beam-side-limits,#beam-limits-panel,#beam-assistix-profile")) continue;
      let next = v
        .replace(/DeepSeek Harness/g, "Beam Agent")
        .replace(/DeepSeek Account/g, "ASSISTIX ID")
        .replace(/Sign in with DeepSeek/g, "Sign in with ASSISTIX ID")
        .replace(/deepseek-v4-flash/gi, "Tide")
        .replace(/gemini-3\\.8-flash(?:-lite)?/gi, "Flare")
        .replace(/grok-4\\.7/gi, "Pine")
        .replace(/DeepSeek/g, "Beam")
        .replace(/Harness/g, "Beam");
      if (ru) {
        for (const [a, b] of RU_DOM) next = next.split(a).join(b);
      }
      if (next !== v) n.nodeValue = next;
    }
  };

  const fixLogos = (root) => {
    if (!root.querySelectorAll) return;
    // Remove duplicate marks: if brandIdentity has >1 img[alt=Beam], keep first
    for (const id of root.querySelectorAll('[class*="brandIdentity"]')) {
      const marks = [...id.querySelectorAll('img[alt="Beam"]')];
      marks.slice(1).forEach((m) => m.remove());
      // hide any svg next to teal img
      if (marks.length) id.querySelectorAll("svg").forEach((s) => { s.style.display = "none"; });
    }
    // Replace black currentColor-looking wordmark imgs that still embed the mark
    for (const img of root.querySelectorAll("img")) {
      const src = img.getAttribute("src") || "";
      if (img.dataset.beamFix === "1") continue;
      if (src.includes("currentColor") && /1066|4748/.test(src)) {
        if (/4748/.test(src)) {
          // full wordmark-with-mark → replace with text
          const span = document.createElement("span");
          span.textContent = "Beam Agent";
          span.style.cssText = 'font-family:"Savona","Segoe UI",system-ui,sans-serif;font-weight:700;font-size:15px;color:#e8f7f5;letter-spacing:-0.02em';
          img.replaceWith(span);
        } else {
          img.src = LOGO;
          img.dataset.beamFix = "1";
        }
      }
    }
  };

  const hideCustomChrome = (root) => {
    if (!root.querySelectorAll) return;
    for (const el of root.querySelectorAll("button, a, [role=button]")) {
      const tx = (el.innerText || el.getAttribute("aria-label") || "").trim();
      if (/^Custom model API$/i.test(tx) || /^Add model provider$/i.test(tx) || /^Third-party model provider$/i.test(tx)) {
        (el.closest("[class*=addBlock], section, article, div") || el).style.display = "none";
      }
    }
  };

  const refresh = async () => {
    try {
      const r = await fetch(BRIDGE + "/assistix/status");
      lastData = await r.json();
    } catch {
      lastData = { signedIn: false, user: null, quotas: {} };
    }
    renderSide(lastData);
    enhanceLimitsPage(lastData);
  };

  const run = () => {
    if (running) return;
    running = true;
    try {
      document.title = "Beam Agent";
      const root = document.body || document.documentElement;
      if (!root) return;
      rewriteText(root);
      fixLogos(root);
      hideCustomChrome(root);
      renderSide(lastData || { quotas: {} });
      enhanceLimitsPage(lastData || { quotas: {} });
      // kill leftover floating profile if any
      const old = document.getElementById("beam-assistix-profile");
      if (old) old.remove();
    } finally {
      running = false;
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; run(); });
  };

  const start = () => {
    run();
    refresh();
    setInterval(refresh, 12000);
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>`;

  html = html.replace(
    /<link rel="stylesheet" href="\.\/assets\/beam-override\.css">[\s\S]*?<\/script>\s*/g,
    ""
  );
  html = html.replace("</head>", inject + "\n</head>");
  fs.writeFileSync(path.join(WEB, "index.html"), html);
  fs.writeFileSync(path.join(WEB, "favicon.svg"), logoSvg);
  fs.writeFileSync(path.join(WEB, "favicon-dark.svg"), logoSvg);
}

console.log("5) Add Limits phrases to RU map for Models pack if ru const exists");
{
  const p = path.join(DSH, "dsh-client-ui-settings-models/lib/client.js");
  let s = fs.readFileSync(p, "utf8");
  // Ensure register has ru
  s = s.replace(
    /locale\.register\(NS,\s*\{\s*zh,\s*en\s*\}\)/,
    "locale.register(NS, { en, ru })"
  );
  s = s.replace(
    /locale\.register\(NS,\s*\{\s*en,\s*zh\s*\}\)/,
    "locale.register(NS, { en, ru })"
  );
  if (/locale\.register\(NS,\s*\{\s*en,\s*ru\s*\}\)/.test(s) && !/const ru = \{/.test(s)) {
    // insert ru after en dict
    const enIdx = s.indexOf("const en = {");
    if (enIdx >= 0) {
      const lit = extractObjectLiteral(s, s.indexOf("{", enIdx));
      const obj = parseEnDict(lit);
      if (obj) {
        const ruObj = translateDict(obj);
        ruObj.nav = "Лимиты";
        ruObj.title = "Лимиты";
        ruObj.intro =
          "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны.";
        const end = s.indexOf("{", enIdx) + lit.length;
        // after `};`
        let insertAt = end;
        if (s[insertAt] === ";") insertAt++;
        const block = `\n\t\t// #region beam-ru\n\t\tconst ru = ${JSON.stringify(ruObj, null, "\t\t\t")};\n\t\t// #endregion beam-ru`;
        s = s.slice(0, insertAt) + block + s.slice(insertAt);
      }
    }
  }
  fs.writeFileSync(p, s);
}

console.log("✓ UI RU + Limits + logo fixes applied");
