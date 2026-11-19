/**
 * Full Russian UI chrome + hero brand row fixes for Beam Agent.
 * Applies to BOTH dist and runtime dsh trees.
 * Merges localization/logo/badge CSS into beam-override without wiping theme work.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Beam-Agent";
const TREES = [
  path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
];

const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const LOGO_TEAL =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(logoSvg);
const BRAND_RU = "Собрано в Beam";
const BRAND_EN = "Build with Beam"; // keep EN dict native for EN locale; scrub forces RU in chrome

/** High-quality phrase map — longer first. */
const PHRASES = [
  ["Open configuration file", "Открыть файл конфигурации"],
  ["Could not open configuration file", "Не удалось открыть файл конфигурации"],
  ["Built-in plugins", "Встроенные плагины"],
  ["Agent presets", "Пресеты агента"],
  ["Sign in with ASSISTIX ID to use Tide, Flare and Pine", "Войдите через ASSISTIX ID, чтобы использовать Tide, Flare и Pine"],
  ["Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed.", "Модели Beam Agent — Tide, Flare и Pine. Доступ через ASSISTIX ID, ключи API не нужны."],
  ["Weekly limits for Tide, Flare and Pine. ASSISTIX ID handles access — no API keys.", "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны."],
  ["Connected via ASSISTIX", "Подключено через ASSISTIX"],
  ["Sign in with ASSISTIX ID", "Войти через ASSISTIX ID"],
  ["Show coding view", "Показать вид кодирования"],
  ["Shows trajectory, code diffs, and all Agent presets", "Показывает траекторию, диффы кода и все пресеты агента"],
  ["Could not save. Please try again.", "Не удалось сохранить. Попробуйте ещё раз."],
  ["Checking for updates…", "Проверка обновлений…"],
  ["Install and Restart", "Установить и перезапустить"],
  ["Retry update", "Повторить обновление"],
  ["Into the Unknown", BRAND_RU],
  ["Build with Beam", BRAND_RU],
  ["DSH Local Build", "Beam Agent"],
  ["Original image preview", "Просмотр оригинала"],
  ["Close original image preview", "Закрыть просмотр"],
  ["Choose workspace", "Выбрать рабочую область"],
  ["Session hierarchy", "Иерархия сессий"],
  ["More conversation views", "Другие виды беседы"],
  ["New session", "Новая сессия"],
  ["New chat", "Новый чат"],
  ["Ask anything", "Спросите что угодно"],
  ["Message Beam Agent", "Сообщение для Beam Agent"],
  ["Type a message", "Введите сообщение"],
  ["Send message", "Отправить сообщение"],
  ["Stop generating", "Остановить генерацию"],
  ["Thinking for", "Думаю ·"],
  ["Deep diving for", "Думаю ·"],
  ["Deep diving", "Думаю"],
  ["Thinking…", "Думаю…"],
  ["Thinking", "Думаю"],
  ["Working…", "Работаю…"],
  ["Running…", "Выполняю…"],
  ["Queued", "В очереди"],
  ["Attach files", "Прикрепить файлы"],
  ["Upload file", "Загрузить файл"],
  ["Drop files here", "Перетащите файлы сюда"],
  ["No conversations yet", "Пока нет бесед"],
  ["No sessions yet", "Пока нет сессий"],
  ["Search chats", "Поиск чатов"],
  ["Search sessions", "Поиск сессий"],
  ["Default workspace", "Рабочая область по умолчанию"],
  ["Current version:", "Текущая версия:"],
  ["Reload to load the new version", "Перезагрузить, чтобы применить новую версию"],
  ["Service version changed", "Версия сервиса изменилась"],
  ["Check your connection and try again", "Проверьте соединение и попробуйте снова"],
  ["Could not check for updates", "Не удалось проверить обновления"],
  ["Could not download the update", "Не удалось скачать обновление"],
  ["Could not install the update", "Не удалось установить обновление"],
  ["Downloading update", "Скачивание обновления"],
  ["Target version", "Целевая версия"],
  ["Verifying update files…", "Проверка файлов обновления…"],
  ["Preparing to restart…", "Подготовка к перезапуску…"],
  ["Please try again later", "Попробуйте позже"],
  ["Please try again", "Попробуйте ещё раз"],
  ["Add an API key to get started", "Войдите через ASSISTIX ID"],
  ["Enter your API keys to use models from the following providers.", "Лимиты моделей Tide, Flare и Pine."],
  ["Third-party model provider", "Сторонний провайдер"],
  ["Custom model API", "Свой API моделей"],
  ["Permission required", "Требуется разрешение"],
  ["Allow once", "Разрешить один раз"],
  ["Allow always", "Разрешить всегда"],
  ["Deny", "Отклонить"],
  ["Approve", "Одобрить"],
  ["Reject", "Отклонить"],
  ["Continue", "Продолжить"],
  ["Dismiss", "Скрыть"],
  ["Clear", "Очистить"],
  ["Rename", "Переименовать"],
  ["Duplicate", "Дублировать"],
  ["Export", "Экспорт"],
  ["Import", "Импорт"],
  ["Download", "Скачать"],
  ["Upload", "Загрузить"],
  ["Refresh", "Обновить"],
  ["Reconnect", "Переподключить"],
  ["Disconnected", "Отключено"],
  ["Reconnecting", "Переподключение"],
  ["Connected", "Подключено"],
  ["Signed in", "Вы вошли"],
  ["Sign out", "Выйти"],
  ["Sign in", "Войти"],
  ["Guest", "Гость"],
  ["Language", "Язык"],
  ["Settings", "Настройки"],
  ["General", "Общие"],
  ["Models", "Лимиты"],
  ["Limits", "Лимиты"],
  ["Account", "Аккаунт"],
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
  ["Theme", "Тема"],
  ["Dark", "Тёмная"],
  ["Light", "Светлая"],
  ["System", "Системная"],
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
  ["Overridden", "Переопределено"],
  ["Enabled", "Включено"],
  ["Disabled", "Выключено"],
  ["Edit", "Изменить"],
  ["Delete", "Удалить"],
  ["Close", "Закрыть"],
  ["Cancel", "Отмена"],
  ["Apply", "Применить"],
  ["Applying…", "Применение…"],
  ["Retry", "Повторить"],
  ["Loading…", "Загрузка…"],
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
  ["Help", "Справка"],
  ["About", "О программе"],
  ["Error", "Ошибка"],
  ["Warning", "Предупреждение"],
  ["Yes", "Да"],
  ["No", "Нет"],
  ["On", "Вкл"],
  ["Off", "Выкл"],
  ["OK", "OK"],
];

function translateValue(v) {
  if (typeof v !== "string") return v;
  let s = v;
  for (const [en, ru] of PHRASES) {
    if (!en) continue;
    if (s === en || s.includes(en)) s = s.split(en).join(ru);
  }
  // brand cleanup leftovers
  s = s
    .replaceAll("DeepSeek Harness", "Beam Agent")
    .replaceAll("DeepSeek Account", "ASSISTIX ID")
    .replaceAll("DeepSeek", "ASSISTIX")
    .replace(/\bHarness\b/g, "Beam Agent");
  return s;
}

function translateDict(en) {
  const ru = {};
  for (const [k, v] of Object.entries(en)) {
    if (k === "hero.headline") {
      ru[k] = BRAND_RU;
      continue;
    }
    if (k === "hero.preview") {
      ru[k] = ""; // badge removed; empty if CSS misses
      continue;
    }
    if (k === "brand.localBuild") {
      ru[k] = "Beam Agent";
      continue;
    }
    ru[k] = translateValue(v);
  }
  return ru;
}

function extractObjectLiteral(src, startIdx) {
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
  try {
    return Function(`"use strict"; return (${literal});`)();
  } catch {
    return null;
  }
}

const CSS_MARKER_START = "/* ===== BEAM RU chrome / logo / preview ===== */";
const CSS_MARKER_END = "/* ===== /BEAM RU chrome ===== */";

const RU_CSS = `${CSS_MARKER_START}
/* Hide Preview / local-build version pills everywhere in chrome */
[class*="previewBadge"],
[class*="PreviewBadge"],
[class*="buildVersion"],
[class*="localBuildBrand"] [class*="buildVersion"],
span[class*="WOwLGG_previewBadge"] {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
}

/* Hero / brand mark: always visible teal Beam logo on dark and light */
[class*="fishHitbox"] img[alt="Beam"],
[class*="brandMark"] img[alt="Beam"],
[class*="railMark"] img[alt="Beam"],
img[alt="Beam"],
[class*="HeroShell"] img[alt="Beam"],
[class*="WOwLGG_fish"],
[class*="_fish_"] {
  filter: none !important;
  opacity: 1 !important;
  color: #00B3BC !important;
}

/* If a dark SVG fish remains, force teal via mask using Beam mark */
[class*="fishHitbox"] > svg,
[class*="WOwLGG_fish"]:not(img),
[class*="_fish_"]:not(img):not([src]) {
  width: 34px !important;
  height: 35px !important;
  color: #00B3BC !important;
  background-color: #00B3BC !important;
  -webkit-mask: url("./beam-mark.svg") center / contain no-repeat !important;
  mask: url("./beam-mark.svg") center / contain no-repeat !important;
}
[class*="fishHitbox"] > svg *,
[class*="WOwLGG_fish"]:not(img) *,
[class*="_fish_"]:not(img):not([src]) * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}

[class*="brandMark"] img,
[class*="railMark"] img {
  filter: none !important;
  opacity: 1 !important;
}

/* Clean title group next to logo */
[class*="titleGroup"],
[class*="WOwLGG_titleGroup"] {
  align-items: center !important;
  gap: 0 !important;
}
[class*="titleGroup"] > span:first-child,
[class*="WOwLGG_titleGroup"] > span:first-child {
  font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;
  font-weight: 600 !important;
  letter-spacing: -0.01em !important;
  color: var(--dsw-alias-label-primary, #e8f7f5) !important;
}
${CSS_MARKER_END}
`;

function upsertCss(cssPath) {
  if (!fs.existsSync(cssPath)) return false;
  let css = fs.readFileSync(cssPath, "utf8");
  const start = css.indexOf(CSS_MARKER_START);
  const end = css.indexOf(CSS_MARKER_END);
  if (start >= 0 && end > start) {
    css = css.slice(0, start) + RU_CSS + css.slice(end + CSS_MARKER_END.length);
  } else {
    css = css.trimEnd() + "\n\n" + RU_CSS + "\n";
  }
  fs.writeFileSync(cssPath, css);
  return true;
}

function patchHeroConversation(clientPath) {
  if (!fs.existsSync(clientPath)) return;
  let s = fs.readFileSync(clientPath, "utf8");

  // Force hero strings in EN + ZH dicts (app may still briefly show EN)
  s = s.replaceAll('"hero.headline": "Into the Unknown"', `"hero.headline": "${BRAND_RU}"`);
  s = s.replaceAll('"hero.headline": "Build with Beam"', `"hero.headline": "${BRAND_RU}"`);
  s = s.replaceAll('"hero.headline": "探索未至之境"', `"hero.headline": "${BRAND_RU}"`);
  s = s.replaceAll('"hero.preview": "Preview"', '"hero.preview": ""');
  s = s.replaceAll('"hero.preview": "预览版"', '"hero.preview": ""');

  // Replace HeroFish with teal Beam mark if still SVG/FishLogo
  const start = s.indexOf("function HeroFish({ hovering }) {");
  const end = s.indexOf("function HeroShell({ t, renderSlot, children }) {", start);
  if (start >= 0 && end > start) {
    const replacement = `function HeroFish({ hovering }) {
\t\t\treturn (0, react_jsx_runtime.jsx)("img", {
\t\t\t\tclassName: HeroShell_module_css_default.fish,
\t\t\t\tsrc: ${JSON.stringify(LOGO_TEAL)},
\t\t\t\talt: "Beam",
\t\t\t\twidth: 34,
\t\t\t\theight: 35,
\t\t\t\tdraggable: false,
\t\t\t\tstyle: {
\t\t\t\t\tdisplay: "block",
\t\t\t\t\ttransform: hovering ? "translateY(-2px) scale(1.04)" : "none",
\t\t\t\t\ttransition: "transform .25s ease",
\t\t\t\t\tfilter: "drop-shadow(0 0 10px rgba(0,179,188,.35))"
\t\t\t\t}
\t\t\t});
\t\t}
\t\t`;
    s = s.slice(0, start) + replacement + s.slice(end);
  }

  // Hide preview badge in JSX by not rendering children span content path — CSS is primary.
  // Also strip badge from tree when empty: keep node but CSS hides.

  fs.writeFileSync(clientPath, s);
}

function patchLocalePacks(dshRoot) {
  const pkgs = fs
    .readdirSync(dshRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("dsh-client"))
    .map((d) => path.join(dshRoot, d.name, "lib", "client.js"))
    .filter((p) => fs.existsSync(p));

  let patched = 0;
  for (const file of pkgs) {
    let s = fs.readFileSync(file, "utf8");
    const orig = s;

    // drop prior beam-ru regions to rebuild
    s = s.replace(/\n\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru\n/g, "\n");

    // locale.register({ zh, en }) → { en, ru } (and named variants)
    s = s.replace(/locale\.register\(([^,]+),\s*\{\s*zh\s*,\s*en\s*\}\)/g, "locale.register($1, { en, ru })");
    s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*zh\s*\}\)/g, "locale.register($1, { en, ru })");
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*zh:\s*\w+\s*,\s*en:\s*(en(?:\$\d+)?)\s*\}\)/g,
      (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName.replace(/^en/, "ru")} })`
    );
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*en:\s*(en(?:\$\d+)?)\s*,\s*zh:\s*\w+\s*\}\)/g,
      (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName.replace(/^en/, "ru")} })`
    );
    // Already { en } only → add ru
    s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*\}\)/g, "locale.register($1, { en, ru })");
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*en:\s*(en(?:\$\d+)?)\s*\}\)/g,
      (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName.replace(/^en/, "ru")} })`
    );
    // If still { en, ru: en } clone pointers, fix after we create ru consts
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*en:\s*(en(?:\$\d+)?)\s*,\s*ru:\s*\2\s*\}\)/g,
      (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName.replace(/^en/, "ru")} })`
    );

    if (/locale\.register\([^)]*\bru\b/.test(s)) {
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
        const vals = Object.values(obj);
        if (!vals.length || !vals.every((v) => typeof v === "string")) continue;
        const ruObj = translateDict(obj);
        if (ruObj.nav === "Models" || obj.nav === "Models" || obj.nav === "Limits") {
          ruObj.nav = "Лимиты";
          ruObj.title = "Лимиты";
          if (ruObj.intro) {
            ruObj.intro =
              "Недельные лимиты Tide, Flare и Pine. Доступ через ASSISTIX ID — ключи API не нужны.";
          }
        }
        if (obj.trigger === "Settings") ruObj.trigger = "Настройки";
        if (obj.title === "Settings") ruObj.title = "Настройки";
        if (obj["language.title"] === "Language") ruObj["language.title"] = "Язык";
        if (obj["general.nav"] === "General") ruObj["general.nav"] = "Общие";

        const json = JSON.stringify(ruObj, null, "\t\t\t");
        inserts.push({
          after: em.index + em[0].length - 1 + lit.length,
          text: `\n\t\t// #region beam-ru\n\t\tconst ${ruName} = ${json};\n\t\t// #endregion beam-ru`,
        });
      }
      inserts.sort((a, b) => b.after - a.after);
      for (const ins of inserts) {
        s = s.slice(0, ins.after) + ";" + ins.text + s.slice(ins.after);
      }
      s = s.replace(/;\s*;\s*\/\/ #region beam-ru/g, ";\n\t\t// #region beam-ru");
    }

    // When register uses ru: en clone (ru points to en var), rewrite to ru var if we created it
    s = s.replace(
      /locale\.register\(([^,]+),\s*\{\s*en:\s*(en(?:\$\d+)?)\s*,\s*ru:\s*\2\s*\}\)/g,
      (all, ns, enName) => {
        const ruName = enName.replace(/^en/, "ru");
        if (s.includes(`const ${ruName} =`)) return `locale.register(${ns}, { en: ${enName}, ru: ${ruName} })`;
        return all;
      }
    );
    s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*ru\s*\}\)/g, (all, ns) => {
      // fine if const ru exists
      return all;
    });

    if (s !== orig) {
      fs.writeFileSync(file, s);
      patched++;
    }
  }
  return patched;
}

function patchClientLocale(dshRoot) {
  const client = path.join(dshRoot, "dsh-client-locale/lib/client.js");
  if (!fs.existsSync(client)) return;
  let s = fs.readFileSync(client, "utf8");

  s = s.replaceAll('const LOCALE_IDS = ["zh", "en"];', 'const LOCALE_IDS = ["en", "ru"];');
  s = s.replaceAll('const LOCALE_IDS = ["en", "zh"];', 'const LOCALE_IDS = ["en", "ru"];');

  if (!s.includes('ru: {') || !s.includes('label: "Русский"')) {
    s = s.replace(
      /const BUILT_IN_LOCALE_METADATA = \{[\s\S]*?\n\t\t\};/,
      `const BUILT_IN_LOCALE_METADATA = {
\t\t\ten: { label: "English" },
\t\t\tru: {
\t\t\t\tlabel: "Русский",
\t\t\t\tfallback: "en"
\t\t\t}
\t\t};`
    );
  }

  const ruCommon = {
    ok: "OK",
    cancel: "Отмена",
    close: "Закрыть",
    copy: "Копировать",
    copied: "Скопировано",
    "codeBlock.title": "Блок кода",
    "codeBlock.wrap": "Перенос строк",
    "codeBlock.unwrap": "Без переноса",
    "copy.failed": "Не удалось скопировать",
    "copy.value": "Копировать значение",
    "copy.json": "Копировать JSON",
    "copy.path": "Копировать путь",
    "copy.prettyJson": "Копировать JSON (красиво)",
    "copy.compactJson": "Копировать JSON (компактно)",
    "copy.optionsHint": "{action}; ПКМ — варианты копирования",
    retry: "Повторить",
    loading: "Загрузка…",
    "load.failed": "Не удалось загрузить",
    submit: "Отправить",
    submitting: "Отправка…",
    next: "Далее",
    previous: "Назад",
    skip: "Пропустить",
    delete: "Удалить",
    edit: "Изменить",
    save: "Сохранить",
    search: "Поиск",
    more: "Ещё",
    collapse: "Свернуть",
    expand: "Развернуть",
    back: "Назад",
    "brand.localBuild": "Beam Agent",
    "workspace.defaultName": "Рабочая область по умолчанию",
    unknown: "Неизвестно",
    none: "Нет",
    truncated: "Обрезано",
    "json.label": "JSON",
    "markdown.footnotes": "Сноски",
    "markdown.truncatedCharacters": "… обрезано, всего {total} символов",
    "number.thousand": "{value}K",
    "number.million": "{value}M",
  };

  if (!s.includes("const ru$1 =")) {
    s = s.replace(
      "const en$1 = {",
      `const ru$1 = ${JSON.stringify(ruCommon)};\n\t\tconst en$1 = {`
    );
  } else {
    // refresh brand.localBuild inside existing ru$1 if present as JSON-ish
    s = s.replace(/("brand\.localBuild":\s*")[^"]*(")/, `$1Beam Agent$2`);
  }

  s = s.replace(
    /locale\.register\(COMMON_NS,\s*\{[\s\S]*?\}\);/,
    `locale.register(COMMON_NS, {
\t\t\t\ten: en$1,
\t\t\t\tru: ru$1
\t\t\t});`
  );

  if (!s.includes('const ru = { "language.title"') && !s.includes("const ru = { \"language.title\"")) {
    s = s.replace(
      'const en = { "language.title": "Language" };',
      'const en = { "language.title": "Language" };\n\t\tconst ru = { "language.title": "Язык" };'
    );
  }

  s = s.replace(
    /locale\.register\(SETTINGS_NS,\s*\{[\s\S]*?\}\);/,
    `locale.register(SETTINGS_NS, {
\t\t\t\ten,
\t\t\t\tru
\t\t\t});`
  );

  s = s.replace(
    'const language = snapshot.active === "zh" ? "zh-CN" : snapshot.active;',
    'const language = snapshot.active === "ru" ? "ru-RU" : (snapshot.active === "en" ? "en" : (snapshot.active === "ru" ? "ru-RU" : "ru-RU"));'
  );
  // Prefer always ru-RU for Beam Russian desktop unless explicitly English
  s = s.replace(
    /const language = snapshot\.active === "ru" \? "ru-RU" : \(snapshot\.active === "en" \? "en" : \(snapshot\.active === "ru" \? "ru-RU" : "ru-RU"\)\);/,
    'const language = snapshot.active === "en" ? "en" : "ru-RU";'
  );

  fs.writeFileSync(client, s);

  const index = path.join(dshRoot, "dsh-client-locale/lib/index.js");
  if (fs.existsSync(index)) {
    let idx = fs.readFileSync(index, "utf8");
    idx = idx.replaceAll('const LOCALE_IDS = ["zh", "en"];', 'const LOCALE_IDS = ["en", "ru"];');
    idx = idx.replaceAll('const LOCALE_IDS = ["en", "zh"];', 'const LOCALE_IDS = ["en", "ru"];');
    fs.writeFileSync(index, idx);
  }
}

function patchBrandOfficial(dshRoot) {
  const p = path.join(dshRoot, "dsh-client-ui-brand-official/lib/client.js");
  if (!fs.existsSync(p)) return;
  const client = `window.__ModuleLoader__.load({
\tid: "@deepseek-ai/dsh-client-ui-brand-official",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
\t\tlet react_jsx_runtime = require("react/jsx-runtime");
\t\tconst MARK = ${JSON.stringify(LOGO_TEAL)};
\t\tfunction OfficialBrandMark({ size }) {
\t\t\tconst s = size || 24;
\t\t\treturn (0, react_jsx_runtime.jsx)("img", {
\t\t\t\tsrc: MARK,
\t\t\t\talt: "Beam",
\t\t\t\twidth: s,
\t\t\t\theight: Math.round(s * 1.038),
\t\t\t\tdraggable: false,
\t\t\t\tstyle: { display: "block", flexShrink: 0 }
\t\t\t});
\t\t}
\t\tfunction OfficialBrandName() {
\t\t\treturn (0, react_jsx_runtime.jsx)("span", {
\t\t\t\tstyle: {
\t\t\t\t\tdisplay: "inline-block",
\t\t\t\t\tfontFamily: '"Savona", "Segoe UI", system-ui, sans-serif',
\t\t\t\t\tfontWeight: 700,
\t\t\t\t\tfontSize: 15,
\t\t\t\t\tlineHeight: "24px",
\t\t\t\t\tletterSpacing: "-0.02em",
\t\t\t\t\tcolor: "var(--dsw-alias-label-primary, #e8f7f5)",
\t\t\t\t\twhiteSpace: "nowrap"
\t\t\t\t},
\t\t\t\tchildren: "Beam Agent"
\t\t\t});
\t\t}
\t\tconst inject = ["slots"];
\t\tfunction apply(ctx) {
\t\t\tctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", function* () {
\t\t\t\tyield ctx.slots.register({ name: "sidebar.brand.mark" }, OfficialBrandMark);
\t\t\t\tyield ctx.slots.register({ name: "sidebar.brand.name" }, OfficialBrandName);
\t\t\t}));
\t\t}
\t\texports.apply = apply;
\t\texports.inject = inject;
\t\treturn module.exports;
\t}
});
`;
  fs.writeFileSync(p, client);
}

function patchIndexInjector(webDist) {
  const htmlPath = path.join(webDist, "index.html");
  if (!fs.existsSync(htmlPath)) return;
  let html = fs.readFileSync(htmlPath, "utf8");

  // Force Russian preference detection more aggressively
  if (!html.includes("beamForceRu")) {
    html = html.replace(
      "const isRu = () => {",
      `const isRu = () => {
    // Beam Agent ships Russian-first chrome
    const beamForceRu = true;
    if (beamForceRu) {
      try {
        const lang = (document.documentElement.lang || "").toLowerCase();
        if (lang.startsWith("en") && localStorage.getItem("beam-lang") === "en") return false;
      } catch {}
      return true;
    }`
    );
  }

  // Expand rewrite pairs
  const needle = "if (isRu()) {\n      pairs.push(";
  if (html.includes(needle) && !html.includes('[/^Build with Beam$/')) {
    html = html.replace(
      needle,
      `if (isRu()) {
      pairs.push(
        [/^Build with Beam$/, "${BRAND_RU}"],
        [/^Into the Unknown$/, "${BRAND_RU}"],
        [/^Preview$/, ""],
        [/^New chat$/, "Новый чат"],
        [/^New session$/, "Новая сессия"],
        [/^Choose workspace$/, "Выбрать рабочую область"],
        [/^Ask anything$/, "Спросите что угодно"],
        [/^Send$/, "Отправить"],
        [/^Stop$/, "Стоп"],
        [/^Search$/, "Поиск"],
        [/^Account$/, "Аккаунт"],
        [/^Workspace$/, "Рабочая область"],
        [/^Sessions$/, "Сессии"],
        [/^Theme$/, "Тема"],
        [/^Dark$/, "Тёмная"],
        [/^Light$/, "Светлая"],
        [/^System$/, "Системная"],
        [/^Sign in$/, "Войти"],
        [/^Sign out$/, "Выйти"],
        [/^Guest$/, "Гость"],
        [/^Connected$/, "Подключено"],
        [/^Disconnected$/, "Отключено"],
        [/^Thinking…$/, "Думаю…"],
        [/^Thinking$/, "Думаю"],
        [/^Working…$/, "Работаю…"],
        [/^DSH Local Build$/, "Beam Agent"],
`
    );
  }

  // DOM: remove preview badges + ensure lang=ru
  if (!html.includes("hidePreviewBadges")) {
    html = html.replace(
      "const hideSettingsNavExtras = () => {",
      `const hidePreviewBadges = () => {
    for (const el of document.querySelectorAll('[class*="previewBadge"], [class*="buildVersion"]')) {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
      if ((el.textContent || "").trim() === "Preview" || /preview/i.test(el.className)) el.textContent = "";
    }
    // Rewrite hero headline leaf if still English
    for (const el of document.querySelectorAll('[class*="titleGroup"] > span, [class*="headline"] > span')) {
      const t = (el.textContent || "").trim();
      if (t === "Build with Beam" || t === "Into the Unknown" || t === "探索未至之境") el.textContent = "${BRAND_RU}";
      if (t === "Preview" || t === "预览版") el.textContent = "";
    }
  };

  const hideSettingsNavExtras = () => {`
    );
    html = html.replace(
      "hideSettingsNavExtras();",
      "hideSettingsNavExtras();\n      hidePreviewBadges();\n      try { if (isRu() && !document.documentElement.lang.startsWith(\"en\")) document.documentElement.lang = \"ru-RU\"; } catch {}"
    );
  }

  html = html.replace('<html lang="en">', '<html lang="ru-RU">');

  fs.writeFileSync(htmlPath, html);

  // Ensure favicons / beam-mark present
  const assets = path.join(webDist, "assets");
  fs.writeFileSync(path.join(webDist, "favicon.svg"), logoSvg);
  fs.writeFileSync(path.join(webDist, "favicon-dark.svg"), logoSvg);
  fs.writeFileSync(path.join(assets, "beam-mark.svg"), logoSvg);
}

function syntaxCheck(file) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  return r.status === 0 ? null : r.stderr;
}

for (const dsh of TREES) {
  if (!fs.existsSync(dsh)) {
    console.log("skip missing", dsh);
    continue;
  }
  console.log("\n===", dsh);
  patchClientLocale(dsh);
  console.log(" locale core patched");
  const n = patchLocalePacks(dsh);
  console.log(" locale packs patched:", n);
  patchHeroConversation(path.join(dsh, "dsh-client-ui-conversation/lib/client.js"));
  console.log(" hero conversation patched");
  patchBrandOfficial(dsh);
  console.log(" brand-official patched");
  const web = path.join(dsh, "dsh-web-frontend/dist");
  patchIndexInjector(web);
  console.log(" index injector patched");
  upsertCss(path.join(web, "assets/beam-override.css"));
  console.log(" CSS chrome rules upserted");

  for (const rel of [
    "dsh-client-ui-conversation/lib/client.js",
    "dsh-client-locale/lib/client.js",
  ]) {
    const err = syntaxCheck(path.join(dsh, rel));
    if (err) {
      console.error("SYNTAX FAIL", rel, err);
      process.exitCode = 1;
    } else console.log(" syntax ok", rel);
  }
}

console.log("\n✓ RU full chrome patch complete");
