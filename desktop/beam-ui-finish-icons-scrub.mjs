/**
 * Finish Beam Agent UI: custom icons + DeepSeek/Harness web scrub + RU leftovers.
 * Merges into existing beam-override / index injectors. Applies dist + runtime.
 * NO VPN. Window/exe rename is out of scope (sibling agent).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const ICONS_SRC = "C:/Users/Alexa/Downloads/icons";
const TREES = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix"),
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai"),
];

/** UI role → flaticon base name (without fi-br-/fi-sr- prefix) */
const ICON_MAP = {
  plus: "plus",
  "plus-small": "plus-small",
  send: "paper-plane",
  "arrow-up": "arrow-up",
  attach: "clip",
  paperclip: "clip",
  plugins: "apps",
  apps: "apps",
  "apps-add": "apps-add",
  automation: "clock",
  clock: "clock",
  more: "menu-dots",
  grid: "grid",
  workspace: "folder",
  folder: "folder",
  "folder-add": "folder-add",
  search: "search",
  refresh: "refresh",
  update: "refresh",
  logout: "sign-out",
  login: "sign-in",
  settings: "settings",
  "settings-sliders": "settings-sliders",
  copy: "copy",
  share: "share",
  "thumbs-up": "thumbs-up",
  "thumbs-down": "thumbs-down",
  bell: "bell",
  edit: "edit",
  trash: "trash",
  check: "check",
  cross: "cross",
  "cross-small": "cross-small",
  "angle-down": "angle-down",
  "angle-up": "angle-up",
  "angle-left": "angle-left",
  "angle-right": "angle-right",
  user: "user",
  document: "document",
  file: "file",
  upload: "upload",
  download: "download",
  comment: "comment",
  home: "home",
  bulb: "bulb",
  rocket: "rocket",
  magic: "magic-wand",
  interactive: "interactive",
  list: "list",
  dashboard: "dashboard",
  recycle: "recycle",
  power: "power",
  "data-transfer": "data-transfer",
  "cloud-upload": "cloud-upload",
};

function recolorSvg(svg) {
  return svg
    .replace(/\sfill="(?!none)[^"]*"/gi, ' fill="currentColor"')
    .replace(/\sstroke="(?!none)[^"]*"/gi, ' stroke="currentColor"')
    .replace(/fill:(?!none)#[0-9a-fA-F]{3,8}/gi, "fill:currentColor")
    .replace(/stroke:(?!none)#[0-9a-fA-F]{3,8}/gi, "stroke:currentColor")
    .replace(/#374957/gi, "currentColor")
    .replace(/#000000|#000\b/gi, "currentColor");
}

function copyIcons(assetsDir) {
  const outBold = path.join(assetsDir, "beam-icons", "bold");
  const outFill = path.join(assetsDir, "beam-icons", "fill");
  fs.mkdirSync(outBold, { recursive: true });
  fs.mkdirSync(outFill, { recursive: true });
  const names = [...new Set(Object.values(ICON_MAP))];
  let n = 0;
  const missing = [];
  for (const name of names) {
    const boldSrc = path.join(ICONS_SRC, "bold", `fi-br-${name}.svg`);
    const fillSrc = path.join(ICONS_SRC, "fill", `fi-sr-${name}.svg`);
    if (!fs.existsSync(boldSrc) || !fs.existsSync(fillSrc)) {
      missing.push(name);
      continue;
    }
    fs.writeFileSync(path.join(outBold, `${name}.svg`), recolorSvg(fs.readFileSync(boldSrc, "utf8")));
    fs.writeFileSync(path.join(outFill, `${name}.svg`), recolorSvg(fs.readFileSync(fillSrc, "utf8")));
    n++;
  }
  // Also write a mapping JSON for the injector
  fs.writeFileSync(
    path.join(assetsDir, "beam-icons", "map.json"),
    JSON.stringify({ map: ICON_MAP, missing }, null, 2)
  );
  return { n, missing };
}

function iconCssRules() {
  const roles = Object.keys(ICON_MAP);
  const lines = [];
  lines.push(`/* ===== BEAM custom icons (flaticon bold/fill → currentColor masks) ===== */`);
  lines.push(`[data-beam-icon] { position: relative !important; }`);
  lines.push(`[data-beam-icon] > svg,
[data-beam-icon] svg.beam-replaced,
button[data-beam-icon] > span > svg,
[class*="panelGlyph"][data-beam-icon] svg,
[class*="iconButton"][data-beam-icon] svg,
.bsl-actions button[data-beam-icon]::before {
  /* placeholder */
}`);

  // Generic: mask only SVG / icon hosts — NEVER bare text spans
  // (span[data-beam-icon] crushed New Session «Новая сессия» to a 14px plus).
  for (const role of roles) {
    const file = ICON_MAP[role];
    lines.push(`
[data-beam-icon="${role}"] > svg,
[data-beam-icon="${role}"] svg.beam-replaced,
[data-beam-icon="${role}"] > i,
button[data-beam-icon="${role}"] > span > svg,
[class*="panelGlyph"][data-beam-icon="${role}"] svg,
[class*="iconButton"][data-beam-icon="${role}"] svg {
  width: 1em !important;
  height: 1em !important;
  min-width: 14px !important;
  min-height: 14px !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${file}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${file}.svg") center / contain no-repeat !important;
}
[data-beam-icon="${role}"] > svg *,
[data-beam-icon="${role}"] svg.beam-replaced *,
[data-beam-icon="${role}"].beam-icon-host > svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
[data-beam-icon="${role}"][data-beam-icon-state="active"] svg,
[aria-current="page"][data-beam-icon="${role}"] svg,
[aria-pressed="true"][data-beam-icon="${role}"] svg,
.wtg9ga_panelActive [data-beam-icon="${role}"] svg,
[class*="panelActive"] [data-beam-icon="${role}"] svg,
[class*="_selected_"] [data-beam-icon="${role}"] svg,
[data-beam-icon="${role}"].is-active svg {
  -webkit-mask: url("./beam-icons/fill/${file}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/fill/${file}.svg") center / contain no-repeat !important;
  color: #00B3BC !important;
  background-color: #00B3BC !important;
}`);
  }

  // Hard-wired chrome selectors (even before JS tags)
  lines.push(`
/* Sidebar New Session — icon SVG only; keep label text readable */
.wtg9ga_newSession > span > span > svg,
.wtg9ga_newSessionContent > svg,
button.wtg9ga_newSession svg,
button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]) svg {
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
}
.wtg9ga_newSessionContent > svg *,
button.wtg9ga_newSession svg *,
button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]) svg * {
  opacity: 0 !important; fill: transparent !important; stroke: transparent !important;
}
/* Restore New Session text if an older injector tagged label spans as icon hosts */
[class*="newSessionLabel"],
[class*="newSessionContent"],
[class*="newSessionLabelMask"],
[class*="newSessionShortcut"] {
  -webkit-mask: none !important;
  mask: none !important;
  background: transparent !important;
  background-color: transparent !important;
  min-width: 0 !important;
  min-height: 0 !important;
  font-size: inherit !important;
  color: inherit !important;
  opacity: 1 !important;
}
[class*="newSessionLabelMask"] { flex: 1 !important; width: auto !important; height: auto !important; }
[class*="newSessionContent"] {
  display: flex !important;
  width: 100cqw !important;
  height: auto !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
}
[class*="newSessionLabel"] {
  display: inline !important;
  width: auto !important;
  height: auto !important;
  max-width: 200px !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}

/* Composer send */
button[aria-label*="Send"] svg,
button[aria-label*="Отправ"] svg,
[class*="sendButton"] svg,
[class*="SendButton"] svg {
  color: #042f2e !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/fill/paper-plane.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/fill/paper-plane.svg") center / contain no-repeat !important;
}
button[aria-label*="Send"] svg *,
button[aria-label*="Отправ"] svg *,
[class*="sendButton"] svg *,
[class*="SendButton"] svg * { opacity: 0 !important; }

/* Attach / plus in composer */
button[aria-label*="Attach"] svg,
button[aria-label*="Прикреп"] svg,
button[aria-label*="file"] svg,
[class*="attach"] svg,
[class*="Attach"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/clip.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/clip.svg") center / contain no-repeat !important;
}
button[aria-label*="Attach"] svg *,
button[aria-label*="Прикреп"] svg *,
[class*="attach"] svg * { opacity: 0 !important; }

/* Search */
button[aria-label*="Search"] svg,
button[aria-label*="Поиск"] svg,
[class*="searchButton"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/search.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/search.svg") center / contain no-repeat !important;
}
button[aria-label*="Search"] svg *,
button[aria-label*="Поиск"] svg * { opacity: 0 !important; }

/* Settings */
button[aria-label*="Settings"] svg,
button[aria-label*="Настрой"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
}
button[aria-label*="Settings"] svg *,
button[aria-label*="Настрой"] svg * { opacity: 0 !important; }

/* Message actions */
button[aria-label*="Copy"] svg, button[aria-label*="Копир"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/copy.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/copy.svg") center / contain no-repeat !important;
}
button[aria-label*="Copy"] svg *, button[aria-label*="Копир"] svg * { opacity: 0 !important; }
button[aria-label*="Share"] svg, button[aria-label*="Подел"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/share.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/share.svg") center / contain no-repeat !important;
}
button[aria-label*="Share"] svg *, button[aria-label*="Подел"] svg * { opacity: 0 !important; }
button[aria-label*="Thumbs up"] svg, button[aria-label*="Нравится"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/thumbs-up.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/thumbs-up.svg") center / contain no-repeat !important;
}
button[aria-label*="Thumbs up"] svg *, button[aria-label*="Нравится"] svg * { opacity: 0 !important; }
button[aria-label*="Thumbs down"] svg, button[aria-label*="Не нравится"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/thumbs-down.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/thumbs-down.svg") center / contain no-repeat !important;
}
button[aria-label*="Thumbs down"] svg *, button[aria-label*="Не нравится"] svg * { opacity: 0 !important; }

/* Limits dock buttons */
#beam-side-limits [data-act="logout"]::before,
#beam-side-limits [data-act="refresh"]::before,
#beam-side-limits [data-act="login"]::before {
  content: "" !important;
  display: inline-block !important;
  width: 12px !important;
  height: 12px !important;
  margin-right: 6px !important;
  vertical-align: -1px !important;
  background-color: currentColor !important;
}
#beam-side-limits [data-act="logout"]::before {
  -webkit-mask: url("./beam-icons/bold/sign-out.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sign-out.svg") center / contain no-repeat !important;
}
#beam-side-limits [data-act="refresh"]::before,
#beam-side-limits [data-act="login"]::before {
  -webkit-mask: url("./beam-icons/bold/refresh.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/refresh.svg") center / contain no-repeat !important;
}
#beam-side-limits [data-act="login"]::before {
  -webkit-mask: url("./beam-icons/bold/sign-in.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sign-in.svg") center / contain no-repeat !important;
}
`);
  lines.push(`/* ===== /BEAM custom icons ===== */`);
  return lines.join("\n");
}

const SELECTION_CSS = `
/* ===== BEAM selection lock ===== */
html, body, #root, [class*="wtg9ga_"], [class*="sidebar"], [class*="Sidebar"],
[class*="titlebar"], [class*="Titlebar"], [class*="toolbar"], [class*="Toolbar"],
[class*="composer"] button, [class*="Composer"] button, nav, header, aside {
  -webkit-user-select: none !important;
  user-select: none !important;
}
[class*="markdown"], [class*="Markdown"],
[class*="messageBody"], [class*="MessageBody"],
[class*="messageContent"], [class*="MessageContent"],
[class*="prose"], [class*="chatTurn"], [class*="ChatTurn"],
[data-message-role], [data-role="assistant"], [data-role="user"],
pre, code, .cm-editor, .cm-content, .cm-line,
textarea, input, [contenteditable="true"],
#beam-auth-gate input, #beam-auth-gate textarea {
  -webkit-user-select: text !important;
  user-select: text !important;
}
img, svg, [class*="brandMark"], [class*="railMark"], [class*="iconButton"],
[class*="panelIcon"], [class*="panelGlyph"], button img, button svg, [data-beam-icon] {
  -webkit-user-drag: none !important;
  user-drag: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
  pointer-events: auto;
}
/* ===== /BEAM selection lock ===== */
`;

const LOGO_CSS = `
/* ===== BEAM logo visibility ===== */
.wtg9ga_brandMark, .wtg9ga_railMark, [class*="brandMark"], [class*="railMark"] {
  color: #00B3BC !important; filter: none !important; opacity: 1 !important;
}
.wtg9ga_brandMark img, .wtg9ga_railMark img, [class*="brandMark"] img, [class*="railMark"] img,
img[alt="Beam"], img[alt="Beam Agent"] {
  filter: none !important; opacity: 1 !important; mix-blend-mode: normal !important;
}
.wtg9ga_buildVersion, [class*="buildVersion"], [class*="previewBadge"], [class*="PreviewBadge"] {
  display: none !important; width: 0 !important; height: 0 !important; overflow: hidden !important;
}
.wtg9ga_brandName, [class*="brandName"], [class*="localBuildTitle"], [class*="fallbackBrandName"] {
  color: var(--dsw-alias-label-primary, #e8f7f5) !important;
}
/* ===== /BEAM logo visibility ===== */
`;

function upsertBlock(css, start, end, block) {
  const full = `${start}\n${block}\n${end}\n`;
  const a = css.indexOf(start);
  const b = css.indexOf(end);
  if (a >= 0 && b > a) return css.slice(0, a) + full + css.slice(b + end.length);
  return css.trimEnd() + "\n\n" + full;
}

function patchCss(cssPath) {
  if (!fs.existsSync(cssPath)) return false;
  let css = fs.readFileSync(cssPath, "utf8");
  css = upsertBlock(css, "/* ===== BEAM selection lock ===== */", "/* ===== /BEAM selection lock ===== */", SELECTION_CSS.replace(/\/\* ===== BEAM selection lock ===== \*\/\n?/, "").replace(/\n?\/\* ===== \/BEAM selection lock ===== \*\//, ""));
  css = upsertBlock(css, "/* ===== BEAM logo visibility ===== */", "/* ===== /BEAM logo visibility ===== */", LOGO_CSS.replace(/\/\* ===== BEAM logo visibility ===== \*\/\n?/, "").replace(/\n?\/\* ===== \/BEAM logo visibility ===== \*\//, ""));
  css = upsertBlock(css, "/* ===== BEAM custom icons (flaticon bold/fill → currentColor masks) ===== */", "/* ===== /BEAM custom icons ===== */", iconCssRules().replace(/^\/\* ===== BEAM custom icons[\s\S]*?===== \*\/\n?/, "").replace(/\n?\/\* ===== \/BEAM custom icons ===== \*\/$/, ""));
  fs.writeFileSync(cssPath, css);
  return true;
}

const EXACT_RU = [
  ['"session.new": "New Session"', '"session.new": "Новая сессия"'],
  ['"session.new.label": "New session"', '"session.new.label": "Новая сессия"'],
  ['"session.new.label": "Новая сессия"', '"session.new.label": "Новая сессия"'],
  ['"toggle.open": "Open sidebar"', '"toggle.open": "Открыть боковую панель"'],
  ['"toggle.collapse": "Collapse sidebar"', '"toggle.collapse": "Свернуть боковую панель"'],
  ['"toggle.collapse": "Свернуть sidebar"', '"toggle.collapse": "Свернуть боковую панель"'],
  ['"panels.label": "Global panels"', '"panels.label": "Глобальные панели"'],
  ['"panel": "Automation tasks"', '"panel": "Задачи автоматизации"'],
  ['"title": "Automation tasks"', '"title": "Задачи автоматизации"'],
  ['"view.chat": "Chat"', '"view.chat": "Чат"'],
  ['"view.trajectory": "Trajectory"', '"view.trajectory": "Процесс"'],
  ['"view.trajectory": "Process"', '"view.trajectory": "Процесс"'],
  ['"view.trajectory": "Траектория"', '"view.trajectory": "Процесс"'],
  ['"trigger.fallback": "Select model"', '"trigger.fallback": "Выбрать модель"'],
  ['"trigger.selectAria": "Select model"', '"trigger.selectAria": "Выбрать модель"'],
  ['"preset.workspaceWrite": "Workspace Write"', '"preset.workspaceWrite": "Запись в рабочую область"'],
  ['"placeholder.default": "Message or run a task, / commands, @ files or sessions"', '"placeholder.default": "Сообщение или задача, / команды, @ файлы или сессии"'],
  ["presetStandardName: \"Standard mode\"", "presetStandardName: \"Стандартный режим\""],
  ['"hero.headline": "Into the Unknown"', '"hero.headline": "Собрано в Beam"'],
  ['"hero.headline": "Build with Beam"', '"hero.headline": "Собрано в Beam"'],
  ['"hero.preview": "Preview"', '"hero.preview": ""'],
  ['"brand.localBuild": "DSH Local Build"', '"brand.localBuild": "Собрано в Beam"'],
  ["DeepSeek Harness", "Beam Agent"],
  ["DeepSeek Account", "ASSISTIX ID"],
  ["DeepSeek", "ASSISTIX"],
];

function scrubFile(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  for (const [a, b] of EXACT_RU) {
    if (s.includes(a)) s = s.split(a).join(b);
  }
  // Don't replace package ids @deepseek-ai/ — those are module paths
  // Only scrub user-visible remaining Harness outside package paths
  s = s.replace(/(?<![@/\\])\bHarness\b/g, "Beam Agent");
  if (s !== orig) {
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function patchIndex(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, "utf8");
  const orig = html;

  // Ensure title
  html = html.replace(/<title>[^<]*<\/title>/, "<title>Beam Agent</title>");

  // Harden document.title scrub + DeepSeek watch
  if (!html.includes("beamScrubDocumentTitle")) {
    const inject = `
  const beamScrubDocumentTitle = () => {
    try {
      const bad = /DeepSeek|Harness/i;
      if (bad.test(document.title) || !document.title || document.title.trim() === "DSH") {
        document.title = "Beam Agent";
      } else if (document.title.includes("DeepSeek") || document.title.includes("Harness")) {
        document.title = document.title.replace(/DeepSeek\\s*Harness/gi, "Beam Agent").replace(/DeepSeek/gi, "ASSISTIX").replace(/\\bHarness\\b/gi, "Beam Agent");
      }
      if (!/Beam Agent/i.test(document.title)) document.title = "Beam Agent";
    } catch {}
  };

  const beamTagIcons = () => {
    // Never treat New Session text hosts as icon-mask targets
    for (const el of document.querySelectorAll('[class*="newSessionLabel"], [class*="newSessionContent"], [class*="newSessionLabelMask"], [class*="newSessionShortcut"]')) {
      el.removeAttribute("data-beam-icon");
      el.removeAttribute("data-beam-icon-state");
    }
    const labelOf = (el) => ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim();
    const rules = [
      [/плагин|plugin/i, "plugins"],
      [/автоматиз|automation|schedule|задач/i, "automation"],
      [/ещё|more|apps add|больше/i, "more"],
      [/новая сессия|new session|new chat|новый чат/i, "plus"],
      [/рабоч|workspace|folder|область/i, "workspace"],
      [/поиск|search/i, "search"],
      [/настрой|settings/i, "settings"],
      [/отправ|send/i, "send"],
      [/прикреп|attach|файл|file|clip/i, "attach"],
      [/обнов|refresh|update/i, "refresh"],
      [/выйти|logout|sign out/i, "logout"],
      [/войти|login|sign in/i, "login"],
      [/копир|copy/i, "copy"],
      [/подел|share/i, "share"],
      [/нравится|thumbs up/i, "thumbs-up"],
      [/не нравится|thumbs down/i, "thumbs-down"],
      [/уведом|bell|notification/i, "bell"],
    ];
    // Do NOT query [class*='newSession'] — that tags Label/Content/Mask spans and hides «Новая сессия».
    const nodes = document.querySelectorAll("button, [role='button'], [class*='panelRow'], [class*='panelGlyph'], [class*='iconButton']");
    for (const el of nodes) {
      if (el.closest("#beam-auth-gate")) continue;
      if (/newSessionLabel|newSessionContent|newSessionLabelMask|newSessionShortcut/i.test(String(el.className || ""))) continue;
      const label = labelOf(el);
      if (!label || label.length > 80) continue;
      for (const [re, role] of rules) {
        if (re.test(label)) {
          el.setAttribute("data-beam-icon", role);
          const active = el.className && /active|selected|panelActive/i.test(String(el.className));
          el.setAttribute("data-beam-icon-state", active ? "active" : "idle");
          break;
        }
      }
    }
  };

  const beamScrubDeepSeekLeaves = () => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      if (!n.nodeValue || !/DeepSeek|Harness/i.test(n.nodeValue)) continue;
      if (n.parentElement?.closest?.("script,style,textarea,input,code,pre,[contenteditable=true]")) continue;
      if ((n.nodeValue || "").length > 200) continue;
      n.nodeValue = n.nodeValue
        .replace(/DeepSeek\\s*Harness/gi, "Beam Agent")
        .replace(/DeepSeek Account/gi, "ASSISTIX ID")
        .replace(/DeepSeek/gi, "ASSISTIX")
        .replace(/\\bHarness\\b/gi, "Beam Agent");
    }
  };
`;
    // Insert before const run =
    if (html.includes("const run = () => {")) {
      html = html.replace("const run = () => {", inject + "\n  const run = () => {");
      html = html.replace(
        /document\.title = "Beam Agent";/,
        `beamScrubDocumentTitle();\n      beamTagIcons();\n      beamScrubDeepSeekLeaves();`
      );
      // Also call at end of run if title set was already replaced elsewhere
      if (!html.includes("beamScrubDocumentTitle();")) {
        html = html.replace(
          "rewriteLeafText(document.body);",
          "rewriteLeafText(document.body);\n      beamScrubDocumentTitle();\n      beamTagIcons();\n      beamScrubDeepSeekLeaves();"
        );
      }
    }
    // Title observer
    if (!html.includes("beamTitleObserver")) {
      html = html.replace(
        "if (document.readyState === \"loading\") document.addEventListener(\"DOMContentLoaded\", start);\n  else start();",
        `if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);\n  else start();\n  try {\n    const beamTitleObserver = new MutationObserver(() => beamScrubDocumentTitle());\n    const armTitle = () => { try { beamTitleObserver.observe(document.querySelector("title") || document.head, { childList: true, characterData: true, subtree: true }); } catch {} };\n    armTitle();\n    setInterval(beamScrubDocumentTitle, 2000);\n  } catch {}\n`
      );
    }
  }

  // Expand RU pairs for remaining chrome
  if (!html.includes("[/^Automation tasks$/")) {
    html = html.replace(
      "[/^DSH Local Build$/, \"Beam Agent\"],",
      `[/^DSH Local Build$/, "Beam Agent"],
        [/^Automation tasks$/, "Задачи автоматизации"],
        [/^Standard mode$/, "Стандартный режим"],
        [/^Chat$/, "Чат"],
        [/^Process$/, "Процесс"],
        [/^Trajectory$/, "Процесс"],
        [/^Select model$/, "Выбрать модель"],
        [/^Workspace Write$/, "Запись в рабочую область"],
        [/^New Session$/, "Новая сессия"],
        [/^Plugins$/, "Плагины"],
        [/^Message or run a task, \\/ commands, @ files or sessions$/, "Сообщение или задача, / команды, @ файлы или сессии"],`
    );
  }

  // Repair: stop tagging New Session label/content/mask spans as icon hosts
  if (html.includes("[class*='newSession']")) {
    html = html.replace(
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelGlyph'], [class*='iconButton'], [class*='newSession']");`,
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelGlyph'], [class*='iconButton']");`
    );
    html = html.replace(
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelRow'], [class*='panelGlyph'], [class*='iconButton'], [class*='newSession']");`,
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelRow'], [class*='panelGlyph'], [class*='iconButton']");`
    );
  }
  if (html.includes("const beamTagIcons = () => {") && !html.includes("beamStripNewSessionIconHosts")) {
    html = html.replace(
      "const beamTagIcons = () => {",
      `const beamStripNewSessionIconHosts = () => {
    for (const el of document.querySelectorAll('[class*="newSessionLabel"], [class*="newSessionContent"], [class*="newSessionLabelMask"], [class*="newSessionShortcut"]')) {
      el.removeAttribute("data-beam-icon");
      el.removeAttribute("data-beam-icon-state");
    }
  };

  const beamTagIcons = () => {
    beamStripNewSessionIconHosts();`
    );
  }

  if (html !== orig) {
    fs.writeFileSync(htmlPath, html);
    return true;
  }
  return false;
}

function patchRuRegions(file) {
  if (!fs.existsSync(file)) return false;
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("// #region beam-ru")) return false;
  const orig = s;
  const fixes = [
    ['"New Session"', '"Новая сессия"'],
    ['"New session"', '"Новая сессия"'],
    ['"Open sidebar"', '"Открыть боковую панель"'],
    ['"Collapse sidebar"', '"Свернуть боковую панель"'],
    ['"Свернуть sidebar"', '"Свернуть боковую панель"'],
    ['"Global panels"', '"Глобальные панели"'],
    ['"Automation tasks"', '"Задачи автоматизации"'],
    ['"Chat"', '"Чат"'],
    ['"Process"', '"Процесс"'],
    ['"Trajectory"', '"Процесс"'],
    ['"Select model"', '"Выбрать модель"'],
    ['"Workspace Write"', '"Запись в рабочую область"'],
    ['"Standard mode"', '"Стандартный режим"'],
    ['"Message or run a task, / commands, @ files or sessions"', '"Сообщение или задача, / команды, @ файлы или сессии"'],
    ['"Preview"', '""'],
    ['"Build with Beam"', '"Собрано в Beam"'],
    ['"Into the Unknown"', '"Собрано в Beam"'],
    ['"DSH Local Build"', '"Собрано в Beam"'],
    ['"DeepSeek Harness"', '"Beam Agent"'],
    ['"DeepSeek"', '"ASSISTIX"'],
  ];
  s = s.replace(/\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru/g, (block) => {
    let b = block;
    for (const [a, c] of fixes) if (b.includes(a)) b = b.split(a).join(c);
    return b;
  });
  if (s !== orig) {
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function patchWebFrontendJs(jsPath) {
  if (!fs.existsSync(jsPath)) return false;
  let s = fs.readFileSync(jsPath, "utf8");
  const orig = s;
  // Boot / visible strings only — careful with package names
  s = s.split("DeepSeek Harness").join("Beam Agent");
  s = s.split("DeepSeek Account").join("ASSISTIX ID");
  // wordmark already Beam Agent in many places; scrub leftover visible phrases
  s = s.replace(/"DeepSeek"/g, '"ASSISTIX"');
  if (s !== orig) {
    fs.writeFileSync(jsPath, s);
    return true;
  }
  return false;
}

console.log("=== Beam UI finish: icons + scrub ===");

for (const tree of TREES) {
  if (!fs.existsSync(tree)) {
    console.log("skip", tree);
    continue;
  }
  const webCandidates = [
    path.join(tree, "beam-web-frontend/dist"),
    path.join(tree, "dsh-web-frontend/dist"),
  ];
  const web = webCandidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  console.log("\nTREE", path.relative(ROOT, tree));
  if (!web) {
    console.log(" skip web frontend (missing)");
  } else {
    const assets = path.join(web, "assets");
    const copied = copyIcons(assets);
    console.log(" icons copied:", copied.n, "missing:", copied.missing.join(",") || "none");

    // Ensure beam-mark / favicon from logo
    const logo = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
    fs.writeFileSync(path.join(assets, "beam-mark.svg"), logo);
    fs.writeFileSync(path.join(web, "favicon.svg"), logo);
    fs.writeFileSync(path.join(web, "favicon-dark.svg"), logo);

    console.log(" css:", patchCss(path.join(assets, "beam-override.css")));
    console.log(" index:", patchIndex(path.join(web, "index.html")));

    // Scrub web frontend JS titles/strings
    for (const f of fs.readdirSync(assets)) {
      if (f.endsWith(".js") && !f.startsWith("langs")) {
        if (patchWebFrontendJs(path.join(assets, f))) console.log(" scrubbed js:", f);
      }
    }
    const man = path.join(web, "manifest.webmanifest");
    if (fs.existsSync(man)) {
      let m = fs.readFileSync(man, "utf8");
      const o = m;
      m = m
        .replace(/DeepSeek\s*Harness/gi, "Beam Agent")
        .replace(/DeepSeek/gi, "Beam Agent")
        .replace(/\bHarness\b/gi, "Beam Agent");
      if (!/"name"\s*:\s*"Beam Agent"/.test(m)) m = m.replace(/"name"\s*:\s*"[^"]*"/, '"name": "Beam Agent"');
      if (!/"short_name"\s*:\s*"Beam Agent"/.test(m)) m = m.replace(/"short_name"\s*:\s*"[^"]*"/, '"short_name": "Beam Agent"');
      if (m !== o) {
        fs.writeFileSync(man, m);
        console.log(" manifest scrubbed");
      }
    }
  }

  // Patch client packages
  let n = 0;
  for (const d of fs.readdirSync(tree, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    if (
      !d.name.startsWith("dsh-client") &&
      !d.name.startsWith("beam-client") &&
      d.name !== "dsh-client-locale" &&
      d.name !== "beam-client-locale"
    ) continue;
    const f = path.join(tree, d.name, "lib", "client.js");
    if (scrubFile(f)) n++;
    if (patchRuRegions(f)) n++;
  }
  console.log(" client files touched:", n);
}

// Write mapping report for parent
const report = {
  iconsSource: ICONS_SRC,
  mapping: ICON_MAP,
  style: "bold/outline = idle; fill/solid = active",
  color: "currentColor / #00B3BC accent on active",
  files: [
    "runtime/.../beam-web-frontend/dist/assets/beam-override.css",
    "runtime/.../beam-web-frontend/dist/assets/beam-icons/**",
    "runtime/.../beam-web-frontend/dist/index.html",
    "dist/Beam Agent/resources/app/... (same)",
    "beam-client-*/lib/client.js RU + brand scrub",
  ],
  newSessionFix:
    "Do not apply span[data-beam-icon] masks or tag newSessionLabel/Content/Mask — that hid «Новая сессия».",
};
fs.writeFileSync(path.join(ROOT, "desktop/_beam-icon-mapping.json"), JSON.stringify(report, null, 2));
console.log("\nWrote desktop/_beam-icon-mapping.json");
console.log("DONE");
