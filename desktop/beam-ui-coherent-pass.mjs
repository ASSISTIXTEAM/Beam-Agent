/**
 * Single coherent Beam Agent UI pass:
 * theme (teal neutrals) + full RU chrome + logo/brand + selection.
 * Applies to BOTH dist and runtime dsh trees.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const TREES = [
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai"),
];

const LOGO_SVG = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const LOGO_DATA = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(LOGO_SVG);

/** Exact string replacements for user-facing EN chrome → natural RU */
const EXACT_RU = [
  // Brand / hero
  ['"hero.headline": "Into the Unknown"', '"hero.headline": "Собрано в Beam"'],
  ['"hero.headline": "Build with Beam"', '"hero.headline": "Собрано в Beam"'],
  ['"hero.preview": "Preview"', '"hero.preview": ""'],
  ['"hero.preview": "预览版"', '"hero.preview": ""'],
  ["Into the Unknown", "Собрано в Beam"],
  ["Build with Beam", "Собрано в Beam"],
  ['"brand.localBuild": "DSH Local Build"', '"brand.localBuild": "Собрано в Beam"'],
  ['"brand.localBuild": "DSH 本地构建"', '"brand.localBuild": "Собрано в Beam"'],
  ['"brand.localBuild": "Beam Agent"', '"brand.localBuild": "Собрано в Beam"'],

  // Sidebar / workspace / session
  ['"session.new": "New Session"', '"session.new": "Новая сессия"'],
  ['"session.new.label": "New session"', '"session.new.label": "Новая сессия"'],
  ['"session.new": "新会话"', '"session.new": "Новая сессия"'],
  ['"session.new.label": "新建会话"', '"session.new.label": "Новая сессия"'],

  // Schedule / automation
  ['"panel": "Automation tasks"', '"panel": "Задачи автоматизации"'],
  ['"title": "Automation tasks"', '"title": "Задачи автоматизации"'],
  ["Automation tasks", "Задачи автоматизации"],

  // Chat / Trajectory tabs
  ['"view.chat": "Chat"', '"view.chat": "Чат"'],
  ['"view.trajectory": "Trajectory"', '"view.trajectory": "Процесс"'],
  ['"view.trajectory": "Process"', '"view.trajectory": "Процесс"'],
  ['"view.trajectory": "Траектория"', '"view.trajectory": "Процесс"'],
  ['"sidebar.chat": "Chat"', '"sidebar.chat": "Чат"'],
  ['"tab.preview": "Preview"', '"tab.preview": "Превью"'],

  // Modes
  ["presetStandardName: \"Standard mode\"", "presetStandardName: \"Стандартный режим\""],
  ['"Standard mode"', '"Стандартный режим"'],
  ["Standard mode", "Стандартный режим"],

  // Composer / model / permissions
  [
    '"placeholder.default": "Message or run a task, / commands, @ files or sessions"',
    '"placeholder.default": "Сообщение или задача, / команды, @ файлы или сессии"',
  ],
  ['"trigger.fallback": "Select model"', '"trigger.fallback": "Выбрать модель"'],
  ['"trigger.selectAria": "Select model"', '"trigger.selectAria": "Выбрать модель"'],
  ['"trigger.aria": "Select model, current {model}"', '"trigger.aria": "Выбрать модель, сейчас {model}"'],
  [
    '"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}"',
    '"trigger.ariaEffort": "Выбрать модель, сейчас {model}, усилие рассуждения {effort}"',
  ],
  ['"preset.workspaceWrite": "Workspace Write"', '"preset.workspaceWrite": "Запись в рабочую область"'],
  ["Select model", "Выбрать модель"],
  ["Workspace Write", "Запись в рабочую область"],
  ["Message or run a task, / commands, @ files or sessions", "Сообщение или задача, / команды, @ файлы или сессии"],
];

const SELECTION_AND_BRAND_CSS = `
/* ===== BEAM chrome selection + brand visibility ===== */
html, body, #root {
  -webkit-user-select: none !important;
  user-select: none !important;
}

/* Allow select only in chat content + editable fields */
[class*="markdown"],
[class*="Markdown"],
[class*="messageBody"],
[class*="MessageBody"],
[class*="messageContent"],
[class*="MessageContent"],
[class*="bubble"] [class*="content"],
[class*="assistantMessage"],
[class*="userMessage"],
[class*="chatMessage"],
[data-message-role],
[data-role="assistant"],
[data-role="user"],
pre, code, .cm-editor, .cm-content,
textarea, input, [contenteditable="true"],
#beam-auth-gate input, #beam-auth-gate textarea {
  -webkit-user-select: text !important;
  user-select: text !important;
}

/* No drag on icons / marks */
img, svg, [class*="brandMark"], [class*="railMark"], [class*="iconButton"],
[class*="panelIcon"], [class*="panelGlyph"], button img, button svg {
  -webkit-user-drag: none !important;
  user-drag: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

/* Logo always visible on dark — force teal mark, never black-on-black */
.wtg9ga_brandMark,
.wtg9ga_railMark,
[class*="brandMark"],
[class*="railMark"] {
  color: #00B3BC !important;
  filter: none !important;
  opacity: 1 !important;
}
.wtg9ga_brandMark img,
.wtg9ga_railMark img,
[class*="brandMark"] img,
[class*="railMark"] img,
img[alt="Beam"],
img[alt="Beam Agent"] {
  filter: none !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
}

/* Hide Preview / empty version badge next to brand line */
.wtg9ga_buildVersion,
[class*="buildVersion"],
[class*="heroPreview"],
[class*="HeroPreview"],
span[class*="preview"]:empty {
  display: none !important;
}

/* Hero brand line: no Preview pill */
[class*="hero"] [class*="preview"],
[class*="Hero"] [class*="preview"],
[class*="headline"] + span[class*="badge"],
[class*="headline"] + span[class*="pill"] {
  display: none !important;
}

/* Harmonize composer / bubbles with teal charcoal */
[class*="composer"],
[class*="Composer"],
[class*="inputMajor"],
[class*="InputMajor"] {
  background: var(--dsw-specific-input-major, var(--beam-elev)) !important;
  border-color: var(--beam-line, rgba(0,179,188,.22)) !important;
}
`;

function patchStringsInFile(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [a, b] of EXACT_RU) {
    if (s.includes(a)) s = s.split(a).join(b);
  }
  // Hide empty hero.preview spans that still render whitespace badge
  if (file.includes("dsh-client-ui-conversation") && s.includes('t("hero.preview")')) {
    // Prefer CSS hide; also empty the zh preview if still set
    s = s.split('"hero.preview": "预览"').join('"hero.preview": ""');
  }
  if (s !== orig) {
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function ensureRuRegister(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  // locale.register(NS, { zh, en }) → add ru when a const ru exists
  s = s.replace(/locale\.register\(([^,]+),\s*\{([^}]*)\}\)/g, (full, ns, inner) => {
    if (!/\ben\b/.test(inner)) return full;
    if (/\bru\b/.test(inner)) return full;
    // Only add ru if const ru / ru$N likely exists nearby — still safe: missing ru throws at runtime
    // so only rewrite if file already has a ru const
    if (!/\bconst ru(?:\$\d+)?\s*=/.test(s) && !s.includes("// #region beam-ru")) return full;
    let next = inner
      .replace(/\bzh\s*,\s*/g, "")
      .replace(/,\s*zh\b/g, "")
      .replace(/\bzh\b/g, "");
    if (/\ben\b/.test(next)) next = next.replace(/\ben\b/, "en, ru");
    else next = "en, ru";
    next = next.replace(/,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "").trim();
    return `locale.register(${ns}, { ${next} })`;
  });
  if (s !== orig) {
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function syncCssFromDist(runtimeCss, distCss) {
  // Prefer the richer dist theme if runtime is smaller; then append selection block once
  let base;
  if (fs.existsSync(distCss)) base = fs.readFileSync(distCss, "utf8");
  else if (fs.existsSync(runtimeCss)) base = fs.readFileSync(runtimeCss, "utf8");
  else return false;

  // Strip prior selection block if re-running
  base = base.replace(/\n\/\* ===== BEAM chrome selection \+ brand visibility ===== \*\/[\s\S]*$/m, "");
  if (!base.includes("cool teal charcoal") && fs.existsSync(distCss)) {
    base = fs.readFileSync(distCss, "utf8");
    base = base.replace(/\n\/\* ===== BEAM chrome selection \+ brand visibility ===== \*\/[\s\S]*$/m, "");
  }
  // Strengthen brandMark rule if present
  if (!base.includes("wtg9ga_brandMark")) {
    // ok — appended below
  }
  const out = base.trimEnd() + "\n" + SELECTION_AND_BRAND_CSS;
  fs.writeFileSync(runtimeCss, out);
  fs.writeFileSync(distCss, out);
  return true;
}

function patchIndexHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, "utf8");
  const orig = html;

  // Force RU preference detection: treat Beam as RU-first UI
  html = html.replace(
    /const isRu = \(\) => \{[\s\S]*?return false;\s*\};/,
    `const isRu = () => {
    try {
      const lang = (document.documentElement.lang || "").toLowerCase();
      if (lang.startsWith("ru")) return true;
      if (lang.startsWith("en") || lang.startsWith("zh")) {
        /* still prefer RU chrome for Beam Agent product */
      }
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i) || "") || "";
        if (/preference["']?\\s*:\\s*["']ru["']/.test(v)) return true;
        if (/preference["']?\\s*:\\s*["']en["']/.test(v)) return true; /* continue — Beam RU scrub still applies */
      }
    } catch {}
    return true; /* Beam Agent ships RU-first */
  };`
  );

  // Expand rewriteLeafText RU pairs — replace the existing isRu() pairs.push block
  const scrubBlock = `
    // Beam RU chrome scrub + brand
    const chromePairs = [
      [/Deep diving for/gi, "Думаю ·"],
      [/Deep diving/gi, "Думаю"],
      [/DeepSeek Harness/g, "Beam Agent"],
      [/DeepSeek Account/g, "ASSISTIX ID"],
      [/@deepseek-ai\\/dsh-client-ui-/g, ""],
      [/@deepseek-ai\\/dsh-/g, ""],
      [/@deepseek-ai\\//g, ""],
      [/DeepSeek/g, "ASSISTIX"],
      [/\\bHarness\\b/g, "Beam Agent"],
      [/Build with Beam/g, "Собрано в Beam"],
      [/Into the Unknown/g, "Собрано в Beam"],
      [/^Preview$/g, ""],
      [/^Automation tasks$/g, "Задачи автоматизации"],
      [/^Standard mode$/g, "Стандартный режим"],
      [/^Chat$/g, "Чат"],
      [/^Process$/g, "Процесс"],
      [/^Trajectory$/g, "Процесс"],
      [/^Select model$/g, "Выбрать модель"],
      [/^Workspace Write$/g, "Запись в рабочую область"],
      [/^New Session$/g, "Новая сессия"],
      [/^New session$/g, "Новая сессия"],
      [/^Models$/g, "Лимиты"],
      [/^Limits$/g, "Лимиты"],
      [/^General$/g, "Общие"],
      [/^Settings$/g, "Настройки"],
      [/^Language$/g, "Язык"],
      [/^Plugins$/g, "Плагины"],
      [/^More$/g, "Ещё"],
      [/^Workspace$/g, "Рабочая область"],
      [/^Open configuration file$/g, "Открыть файл конфигурации"],
      [/^Message or run a task, \\/ commands, @ files or sessions$/g, "Сообщение или задача, / команды, @ файлы или сессии"],
    ];
`;

  // Replace rewriteLeafText function body pairs construction
  if (html.includes("const rewriteLeafText")) {
    html = html.replace(
      /const rewriteLeafText = \(root\) => \{[\s\S]*?const pairs = \[[\s\S]*?\];\s*if \(isRu\(\)\) \{[\s\S]*?\}\s*/m,
      `const rewriteLeafText = (root) => {
    if (!root || document.querySelector('[aria-modal="true"]')) return;
    if (isGateFormInteractive()) return;
${scrubBlock}
    const pairs = chromePairs;
`
    );
  }

  // Brand DOM fixer: replace logo mark, hide Preview, rewrite brand line
  if (!html.includes("beamFixBrandChrome")) {
    const brandFix = `
  const beamFixBrandChrome = () => {
    // Force teal Beam mark in sidebar
    for (const mark of document.querySelectorAll('[class*="brandMark"], [class*="railMark"]')) {
      const img = mark.querySelector("img");
      if (img) {
        if (!img.src || img.src.includes("fish") || /deepseek/i.test(img.src)) {
          img.src = ${JSON.stringify(LOGO_DATA)};
        }
        img.alt = "Beam";
        img.style.filter = "none";
        img.style.opacity = "1";
      } else if (!mark.querySelector("img") && !mark.dataset.beamMark) {
        mark.dataset.beamMark = "1";
        mark.innerHTML = '<img src="' + ${JSON.stringify(LOGO_DATA)} + '" alt="Beam" width="24" height="24" draggable="false" style="display:block;filter:none;opacity:1">';
      }
    }
    // Brand name / local build title → RU line
    for (const el of document.querySelectorAll('[class*="localBuildTitle"], [class*="fallbackBrandName"], [class*="brandName"]')) {
      const t = (el.textContent || "").trim();
      if (/Build with Beam|Into the Unknown|DSH Local Build|DSH 本地|Local Build/i.test(t)) {
        if (el.childElementCount === 0) el.textContent = "Собрано в Beam";
        else {
          for (const n of el.childNodes) {
            if (n.nodeType === 3 && /Build with Beam|Into the Unknown|DSH|Local Build/i.test(n.nodeValue || "")) {
              n.nodeValue = "Собрано в Beam";
            }
          }
        }
      }
    }
    // Hide Preview badges near brand / hero
    for (const el of document.querySelectorAll('[class*="buildVersion"], [class*="hero"] span, [class*="headline"] + span')) {
      const t = (el.textContent || "").trim();
      if (t === "Preview" || t === "预览版" || t === "预览" || t === "") {
        if (t === "Preview" || t === "预览版" || t === "预览" || (el.className || "").includes("buildVersion")) {
          el.style.display = "none";
        }
      }
    }
    // Placeholder scrub on composer
    for (const el of document.querySelectorAll("textarea, input, [data-placeholder], [class*='placeholder']")) {
      const ph = el.getAttribute("placeholder");
      if (ph && /Message or run a task/i.test(ph)) {
        el.setAttribute("placeholder", "Сообщение или задача, / команды, @ файлы или сессии");
      }
    }
  };
`;
    html = html.replace(
      /const run = \(\) => \{/,
      brandFix + `\n  const run = () => {`
    );
    html = html.replace(
      /rewriteLeafText\(document\.body\);/,
      `rewriteLeafText(document.body);\n      beamFixBrandChrome();`
    );
  }

  // lang attribute
  html = html.replace('<html lang="en">', '<html lang="ru">');

  if (html !== orig) {
    fs.writeFileSync(htmlPath, html);
    return true;
  }
  return false;
}

function copyBeamRuFromDistToRuntime() {
  const distRoot = TREES[1];
  const runtimeRoot = TREES[0];
  let copied = 0;
  if (!fs.existsSync(distRoot) || !fs.existsSync(runtimeRoot)) return 0;
  const pkgs = fs.readdirSync(distRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("dsh-client"))
    .map((d) => d.name);
  for (const name of pkgs) {
    const distFile = path.join(distRoot, name, "lib", "client.js");
    const rtFile = path.join(runtimeRoot, name, "lib", "client.js");
    if (!fs.existsSync(distFile) || !fs.existsSync(rtFile)) continue;
    const dist = fs.readFileSync(distFile, "utf8");
    if (!dist.includes("// #region beam-ru")) continue;
    let rt = fs.readFileSync(rtFile, "utf8");
    if (rt.includes("// #region beam-ru")) continue;
    // Copy whole file from dist when it has beam-ru and runtime doesn't —
    // dist is the source of truth for prior RU injections.
    fs.writeFileSync(rtFile, dist);
    copied++;
  }
  return copied;
}

console.log("=== Beam coherent UI pass ===");

console.log("0) Copy beam-ru packages dist → runtime where missing");
console.log("  copied:", copyBeamRuFromDistToRuntime());

console.log("1) Theme CSS sync + selection/brand");
{
  const distCss = path.join(TREES[1], "dsh-web-frontend/dist/assets/beam-override.css");
  const rtCss = path.join(TREES[0], "dsh-web-frontend/dist/assets/beam-override.css");
  console.log("  css:", syncCssFromDist(rtCss, distCss));
}

console.log("2) Exact RU + brand string patches in both trees");
{
  let n = 0;
  for (const tree of TREES) {
    const pkgs = fs.readdirSync(tree, { withFileTypes: true })
      .filter((d) => d.isDirectory() && (d.name.startsWith("dsh-client") || d.name === "dsh-client-locale"))
      .map((d) => path.join(tree, d.name, "lib", "client.js"));
    // also locale
    pkgs.push(path.join(tree, "dsh-client-locale/lib/client.js"));
    for (const f of [...new Set(pkgs)]) {
      if (patchStringsInFile(f)) n++;
      ensureRuRegister(f);
    }
  }
  console.log("  files patched:", n);
}

console.log("3) index.html injectors (dist + runtime)");
for (const tree of TREES) {
  const html = path.join(tree, "dsh-web-frontend/dist/index.html");
  console.log(" ", path.relative(ROOT, html), patchIndexHtml(html));
}

console.log("4) Patch beam-ru dictionary values that still have English key phrases");
{
  const fixRuDicts = (file) => {
    if (!fs.existsSync(file)) return false;
    let s = fs.readFileSync(file, "utf8");
    if (!s.includes("// #region beam-ru")) return false;
    const orig = s;
    const ruFixes = [
      ['"Chat"', '"Чат"'],
      ['"Process"', '"Процесс"'],
      ['"Trajectory"', '"Процесс"'],
      ['"Select model"', '"Выбрать модель"'],
      ['"Select model, current {model}"', '"Выбрать модель, сейчас {model}"'],
      ['"Select model, current {model}, reasoning effort {effort}"', '"Выбрать модель, сейчас {model}, усилие рассуждения {effort}"'],
      ['"Workspace Write"', '"Запись в рабочую область"'],
      ['"Automation tasks"', '"Задачи автоматизации"'],
      ['"Standard mode"', '"Стандартный режим"'],
      ['"New Session"', '"Новая сессия"'],
      ['"New session"', '"Новая сессия"'],
      ['"Message or run a task, / commands, @ files or sessions"', '"Сообщение или задача, / команды, @ файлы или сессии"'],
      ['"Preview"', '""'],
      ['"Build with Beam"', '"Собрано в Beam"'],
      ['"Into the Unknown"', '"Собрано в Beam"'],
      ['"DSH Local Build"', '"Собрано в Beam"'],
    ];
    // Only inside beam-ru regions
    s = s.replace(/\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru/g, (block) => {
      let b = block;
      for (const [a, c] of ruFixes) {
        if (b.includes(a)) b = b.split(a).join(c);
      }
      return b;
    });
    if (s !== orig) {
      fs.writeFileSync(file, s);
      return true;
    }
    return false;
  };
  let n = 0;
  for (const tree of TREES) {
    const pkgs = fs.readdirSync(tree, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith("dsh-client"))
      .map((d) => path.join(tree, d.name, "lib", "client.js"));
    for (const f of pkgs) if (fixRuDicts(f)) n++;
  }
  console.log("  ru dict files fixed:", n);
}

console.log("DONE");
