/**
 * Beam Agent P0 UI polish (sibling-safe):
 * 1) Workspace → Project (user-facing RU+EN only)
 * 2) Restore «Новая сессия» / New session label (icon injector must not mask text)
 * 3) Hide third-party provider / custom API / base-URL chrome
 * 4) Full RU/EN dictionaries — no mixed chrome leftovers
 * 5) Sync dist + runtime web frontend + locale packs
 *
 * Does NOT touch OAuth/bridge plumbing unless required for UI packs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TREES = [
  path.join(ROOT, "dist", "Beam Agent", "resources", "app"),
  path.join(ROOT, "runtime", "app"),
].filter((p) => fs.existsSync(p));

const summary = {
  trees: [],
  filesTouched: [],
  workspacePairs: 0,
  i18nPairs: 0,
  cssFixes: 0,
  htmlFixes: 0,
  providerHides: 0,
};

function touch(file) {
  const rel = path.relative(ROOT, file);
  if (!summary.filesTouched.includes(rel)) summary.filesTouched.push(rel);
}

function writeIfChanged(file, next) {
  if (!fs.existsSync(file)) return false;
  const prev = fs.readFileSync(file, "utf8");
  if (prev === next) return false;
  fs.writeFileSync(file, next);
  touch(file);
  return true;
}

function applyPairs(file, pairs) {
  if (!fs.existsSync(file)) return 0;
  let s = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [a, b] of pairs) {
    if (!a || a === b) continue;
    if (s.includes(a)) {
      const parts = s.split(a);
      if (parts.length > 1) {
        s = parts.join(b);
        n += parts.length - 1;
      }
    }
  }
  if (n && writeIfChanged(file, s)) return n;
  return 0;
}

/** User-facing workspace → project (EN + RU). Keep keys / APIs intact. */
const WORKSPACE_TO_PROJECT = [
  // EN dict values
  ['"defaultWorkspace.failed": "Unable to create default workspace. Use Choose workspace to select a folder."',
    '"defaultWorkspace.failed": "Unable to create the default project. Use Choose project to select a folder."'],
  ['"draft.workspaceRequired": "Choose a workspace first."',
    '"draft.workspaceRequired": "Choose a project first."'],
  ['"shortcut.directoryBusy": "Selecting or adding a workspace"',
    '"shortcut.directoryBusy": "Selecting or adding a project"'],
  ['"section.workspaces": "Workspaces"', '"section.workspaces": "Projects"'],
  ['"section.workspaces": "Workspace"', '"section.workspaces": "Project"'],
  ['"groupBy.workspace": "WorkSpace"', '"groupBy.workspace": "Project"'],
  ['"groupBy.workspace": "Workspace"', '"groupBy.workspace": "Project"'],
  ['"groupBy.workspaceTree": "Workspace Tree"', '"groupBy.workspaceTree": "Project tree"'],
  ['"workspace.add": "Add workspace"', '"workspace.add": "Add project"'],
  ['"menu.addWorkspace": "Add workspace…"', '"menu.addWorkspace": "Add project…"'],
  ['"menu.addWorkspace": "Add workspace..."', '"menu.addWorkspace": "Add project…"'],
  ['"picker.loading": "Loading workspaces…"', '"picker.loading": "Loading projects…"'],
  ['"picker.loading": "Loading workspaces..."', '"picker.loading": "Loading projects…"'],
  ['"conflict.named": "A workspace named “{name}” already exists."',
    '"conflict.named": "A project named “{name}” already exists."'],
  ['"rename.workspace.title": "Rename workspace"', '"rename.workspace.title": "Rename project"'],
  ['"field.workspaceName": "Workspace name"', '"field.workspaceName": "Project name"'],
  ['"delete.workspace": "Delete workspace"', '"delete.workspace": "Delete project"'],
  ['"delete.desc": "This removes “{name}” from the workspace list. The folder and session logs will be kept. Its sessions will appear under Ungrouped."',
    '"delete.desc": "This removes “{name}” from the project list. The folder and session logs will be kept. Its sessions will appear under Ungrouped."'],
  ['"delete.pending": "Deleting workspace…"', '"delete.pending": "Deleting project…"'],
  ['"actions.workspace.aria": "Workspace actions for {name}"',
    '"actions.workspace.aria": "Project actions for {name}"'],
  ['"hero.chooseWorkspace": "Select workspace"', '"hero.chooseWorkspace": "Choose project"'],
  ['"hero.chooseWorkspace": "Choose workspace"', '"hero.chooseWorkspace": "Choose project"'],
  ['"placeholder.workspace": "Choose a workspace to start"',
    '"placeholder.workspace": "Choose a project to start"'],
  ['"preset.workspaceWrite": "Workspace Write"', '"preset.workspaceWrite": "Project write"'],
  ['"preset.workspaceWrite": "Workspace write"', '"preset.workspaceWrite": "Project write"'],

  // RU dict values (рабочая область → проект)
  ['"defaultWorkspace.failed": "Не удалось создать рабочую область по умолчанию. Выберите папку через «Выбрать рабочую область»."',
    '"defaultWorkspace.failed": "Не удалось создать проект по умолчанию. Выберите папку через «Выбрать проект»."'],
  ['"draft.workspaceRequired": "Сначала выберите рабочую область."',
    '"draft.workspaceRequired": "Сначала выберите проект."'],
  ['"section.workspaces": "Рабочие области"', '"section.workspaces": "Проекты"'],
  ['"section.workspaces": "Рабочая область"', '"section.workspaces": "Проект"'],
  ['"section.workspaces": "Рабочая областьs"', '"section.workspaces": "Проекты"'],
  ['"workspace.add": "Добавить рабочую область"', '"workspace.add": "Добавить проект"'],
  ['"menu.addWorkspace": "Добавить рабочую область…"', '"menu.addWorkspace": "Добавить проект…"'],
  ['"picker.loading": "Загрузка рабочих областей…"', '"picker.loading": "Загрузка проектов…"'],
  ['"hero.chooseWorkspace": "Выбрать рабочую область"', '"hero.chooseWorkspace": "Выбрать проект"'],
  ['"placeholder.workspace": "Выберите рабочую область, чтобы начать"',
    '"placeholder.workspace": "Выберите проект, чтобы начать"'],
  ['"preset.workspaceWrite": "Запись в рабочую область"', '"preset.workspaceWrite": "Запись в проект"'],
  ['"groupBy.workspace": "По рабочей области"', '"groupBy.workspace": "По проекту"'],
  ['"groupBy.workspaceTree": "Дерево рабочих областей"', '"groupBy.workspaceTree": "Дерево проектов"'],
  ['"rename.workspace.title": "Переименовать рабочую область"',
    '"rename.workspace.title": "Переименовать проект"'],
  ['"field.workspaceName": "Название рабочей области"', '"field.workspaceName": "Название проекта"'],
  ['"delete.workspace": "Удалить рабочую область"', '"delete.workspace": "Удалить проект"'],
  ['"delete.pending": "Удаление рабочей области…"', '"delete.pending": "Удаление проекта…"'],
  ['"actions.workspace.aria": "Действия рабочей области «{name}»"',
    '"actions.workspace.aria": "Действия проекта «{name}»"'],
  ['"shortcut.directoryBusy": "Selecting or adding a workspace"',
    '"shortcut.directoryBusy": "Выбор или добавление проекта"'],

  // Hard-coded / injector leftover phrases
  ["Выбрать рабочую область", "Выбрать проект"],
  ["выбрать рабочую область", "выбрать проект"],
  ["Loading workspaces…", "Loading projects…"],
  ["Loading workspaces...", "Loading projects…"],
  ["Add workspace…", "Add project…"],
  ["Add workspace", "Add project"],
  ["Choose workspace", "Choose project"],
  ["Select workspace", "Choose project"],
  ["Workspace Write", "Project write"],
  ["Запись в рабочую область", "Запись в проект"],
  ["Загрузка рабочих областей…", "Загрузка проектов…"],
  ["Добавить рабочую область", "Добавить проект"],
  ["рабочую область", "проект"],
  ["рабочей области", "проекта"],
  ["рабочих областей", "проектов"],
  ["Рабочие области", "Проекты"],
  ["Рабочая область", "Проект"],
];

/** Common EN leftovers → RU (applied only inside // #region beam-ru … or const ru = {…}) when possible;
 *  also dual-register known chrome keys in both dicts. */
const RU_CHROME_FIXES = [
  ['"Loading…"', '"Загрузка…"'],
  ['"Loading..."', '"Загрузка…"'],
  ['"Loading"', '"Загрузка"'],
  ['"Completed in"', '"Завершено за"'],
  ['"Completed in {duration}"', '"Завершено за {duration}"'],
  ['"Usage"', '"Использование"'],
  ['"Application"', '"Приложение"'],
  ['"Edit"', '"Изменить"'],
  ['"Cancel"', '"Отмена"'],
  ['"Save"', '"Сохранить"'],
  ['"Close"', '"Закрыть"'],
  ['"Open"', '"Открыть"'],
  ['"Retry"', '"Повторить"'],
  ['"Refresh"', '"Обновить"'],
  ['"Settings"', '"Настройки"'],
  ['"Search"', '"Поиск"'],
  ['"Send"', '"Отправить"'],
  ['"Copy"', '"Копировать"'],
  ['"Share"', '"Поделиться"'],
  ['"Delete"', '"Удалить"'],
  ['"Rename"', '"Переименовать"'],
  ['"Continue"', '"Продолжить"'],
  ['"Back"', '"Назад"'],
  ['"Next"', '"Далее"'],
  ['"Done"', '"Готово"'],
  ['"Error"', '"Ошибка"'],
  ['"Warning"', '"Предупреждение"'],
  ['"Success"', '"Успешно"'],
  ['"Unknown"', '"Неизвестно"'],
  ['"Untitled"', '"Без названия"'],
  ['"No sessions yet"', '"Пока нет сессий"'],
  ['"empty.none": "No sessions yet"', '"empty.none": "Пока нет сессий"'],
  ['"folderError.retry": "Choose again"', '"folderError.retry": "Выбрать снова"'],
  ['"folderError.title": "Couldn’t open folder"', '"folderError.title": "Не удалось открыть папку"'],
  ['"folderError.title": "Couldn\'t open folder"', '"folderError.title": "Не удалось открыть папку"'],
  ['"session.new": "New Session"', '"session.new": "Новая сессия"'],
  ['"session.new": "New session"', '"session.new": "Новая сессия"'],
  ['"session.new.label": "New session"', '"session.new.label": "Новая сессия"'],
  ['"session.new.label": "New Session"', '"session.new.label": "Новая сессия"'],
];

const EN_CHROME_ENSURE = [
  ['"session.new": "Новая сессия"', '"session.new": "New session"'], // only inside EN blocks — handled carefully below
];

const NEW_SESSION_CSS = `
/* ===== BEAM P0: restore New session label text (icon mask must not eat the label) ===== */
button.wtg9ga_newSession,
button[class*="newSession"] {
  gap: 6px !important;
}
button.wtg9ga_newSession:not(.wtg9ga_collapsed *):not([class*="collapsed"] *),
.wtg9ga_rail:not(.wtg9ga_collapsed) button.wtg9ga_newSession,
button.wtg9ga_newSession {
  /* expanded sidebar control keeps readable padding */
  min-width: 0 !important;
}
.wtg9ga_newSessionLabel,
.wtg9ga_newSessionContent,
.wtg9ga_newSessionLabelMask,
.wtg9ga_newSessionShortcut,
[class*="newSessionLabel"],
[class*="newSessionContent"],
[class*="newSessionLabelMask"],
[class*="newSessionShortcut"] {
  -webkit-mask: none !important;
  mask: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  color: inherit !important;
  opacity: 1 !important;
  font-size: 14px !important;
  line-height: 22px !important;
  width: auto !important;
  height: auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: 200px !important;
  overflow: visible !important;
}
.wtg9ga_newSessionLabel,
[class*="newSessionLabel"] {
  white-space: nowrap !important;
  display: inline-block !important;
  visibility: visible !important;
  color: var(--dsw-alias-label-primary, #f2faf8) !important;
}
.wtg9ga_newSessionContent,
[class*="newSessionContent"] {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  width: auto !important;
  max-width: none !important;
}
.wtg9ga_newSessionLabelMask,
[class*="newSessionLabelMask"] {
  display: inline-flex !important;
  flex: 1 1 auto !important;
  min-width: 0 !important;
  width: auto !important;
  overflow: visible !important;
}
/* Only the SVG glyph is an icon host */
button.wtg9ga_newSession > svg,
button.wtg9ga_newSession svg,
button[class*="newSession"] > svg,
button[class*="newSession"] svg {
  width: 14px !important;
  height: 14px !important;
  min-width: 14px !important;
  min-height: 14px !important;
  flex: none !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
}
button.wtg9ga_newSession svg *,
button[class*="newSession"] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
/* Collapsed rail: icon-only is OK */
.wtg9ga_collapsed .wtg9ga_newSessionLabel,
.wtg9ga_collapsed [class*="newSessionLabel"] {
  max-width: 0 !important;
  overflow: hidden !important;
  font-size: 0 !important;
}
`;

const PROVIDER_HIDE_CSS = `
/* ===== BEAM P0: hide third-party / custom API provider chrome ===== */
[class*="addBlock"],
[class*="AddBlock"],
button[aria-label*="Custom model" i],
button[aria-label*="Add model provider" i],
button[aria-label*="Third-party" i],
button[aria-label*="Свой API" i],
button[aria-label*="Сторонн" i],
[data-testid*="custom-provider" i],
[data-testid*="add-provider" i] {
  display: none !important;
}
/* Base URL / developer catalog rows in models settings */
label:has(input[placeholder*="base URL" i]),
label:has(input[placeholder*="Base URL" i]),
label:has(input[name*="baseUrl" i]),
div:has(> input[placeholder*="https://" i]):has(label),
[class*="baseUrl"],
[class*="BaseUrl"],
[class*="endpointField"],
[class*="EndpointField"] {
  display: none !important;
}
/* Official plumbing names if they leak */
[data-provider-id="assistix-official"],
[data-provider-id*="kumo" i] {
  /* keep for routing; hide verbose labels via sibling rules */
}
[class*="providerName"],
[class*="ProviderName"],
[class*="providerId"],
[class*="ProviderId"] {
  display: none !important;
}
`;

function patchLocaleFile(file) {
  let n = 0;
  n += applyPairs(file, WORKSPACE_TO_PROJECT);
  // RU region-aware chrome fixes: only replace inside beam-ru or const ru blocks when markers exist
  if (!fs.existsSync(file)) return n;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;

  // Prefer patching // #region beam-ru … #endregion
  s = s.replace(/\/\/ #region beam-ru[\s\S]*?\/\/ #endregion beam-ru/g, (block) => {
    let b = block;
    for (const [a, c] of RU_CHROME_FIXES) {
      if (b.includes(a)) {
        const parts = b.split(a);
        summary.i18nPairs += parts.length - 1;
        b = parts.join(c);
        n += parts.length - 1;
      }
    }
    // Also apply workspace→project inside RU region (already mostly done globally)
    for (const [a, c] of WORKSPACE_TO_PROJECT) {
      if (b.includes(a)) {
        const parts = b.split(a);
        b = parts.join(c);
      }
    }
    return b;
  });

  // Also patch objects that look like const ru = { ... } after zh/en (lightweight)
  s = s.replace(/\b(?:const|let|var)\s+ru\s*=\s*\{[\s\S]*?\n\s*\};/g, (block) => {
    let b = block;
    for (const [a, c] of [...RU_CHROME_FIXES, ...WORKSPACE_TO_PROJECT]) {
      if (b.includes(a)) b = b.split(a).join(c);
    }
    return b;
  });

  // Ensure EN blocks keep English project wording (not RU)
  s = s.replace(/\b(?:const|let|var)\s+en\s*=\s*\{[\s\S]*?\n\s*\};/g, (block) => {
    let b = block;
    // If RU leaked into EN, restore EN project strings
    b = b
      .split('"Выбрать проект"').join('"Choose project"')
      .split('"Загрузка проектов…"').join('"Loading projects…"')
      .split('"Добавить проект"').join('"Add project"')
      .split('"Добавить проект…"').join('"Add project…"')
      .split('"Проекты"').join('"Projects"')
      .split('"Проект"').join('"Project"')
      .split('"Запись в проект"').join('"Project write"')
      .split('"Новая сессия"').join('"New session"');
    return b;
  });

  if (s !== orig && writeIfChanged(file, s)) return Math.max(n, 1);
  return n;
}

function walkClientJs(assistixRoot, onFile) {
  if (!fs.existsSync(assistixRoot)) return;
  for (const ent of fs.readdirSync(assistixRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (!ent.name.startsWith("beam-")) continue;
    // skip heavy non-UI
    if (/^beam-(api-|acp|bash|chunked|atomic|authorization|attachment|anonymous)/.test(ent.name)) {
      // still allow a few that have UI remotes? skip most
      if (!/ui|client|preset|locale|conversation|sidebar|workspace|settings|composer|schedule/.test(ent.name)) {
        continue;
      }
    }
    const lib = path.join(assistixRoot, ent.name, "lib");
    if (!fs.existsSync(lib)) continue;
    for (const name of ["client.js", "index.js"]) {
      const f = path.join(lib, name);
      if (fs.existsSync(f)) onFile(f);
    }
  }
}

function patchOverrideCss(webDist) {
  const cssPath = path.join(webDist, "assets", "beam-override.css");
  if (!fs.existsSync(cssPath)) return false;
  let css = fs.readFileSync(cssPath, "utf8");
  // Remove prior P0 markers then append fresh
  css = css.replace(/\n?\/\* ===== BEAM P0: restore New session[\s\S]*?(?=\/\* ===== BEAM P0: hide third-party|$)/, "\n");
  css = css.replace(/\n?\/\* ===== BEAM P0: hide third-party[\s\S]*$/, "\n");
  // Soften dangerous span[data-beam-icon="plus"] rule so it never masks text labels
  css = css.replace(
    /\[data-beam-icon="plus"\] svg,\s*\[data-beam-icon="plus"\] > i,\s*span\[data-beam-icon="plus"\]\s*\{/g,
    '[data-beam-icon="plus"] > svg,\n[data-beam-icon="plus"] svg:only-child,\n[data-beam-icon="plus"] > i,\nspan[data-beam-icon="plus"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]):empty {\n',
  );
  // Generic: never mask labeled text spans
  if (!css.includes("BEAM P0: restore New session")) {
    css += "\n" + NEW_SESSION_CSS + "\n" + PROVIDER_HIDE_CSS + "\n";
    summary.cssFixes++;
  }
  return writeIfChanged(cssPath, css);
}

function patchIndexHtml(webDist) {
  const htmlPath = path.join(webDist, "index.html");
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, "utf8");
  const orig = html;

  // Ensure strip hosts exists and also clears styles
  if (!html.includes("beamStripNewSessionIconHosts")) {
    // insert before beamTagIcons if possible
    html = html.replace(
      /const beamTagIcons = \(\) => \{/,
      `const beamStripNewSessionIconHosts = () => {
    for (const el of document.querySelectorAll('[class*="newSessionLabel"], [class*="newSessionContent"], [class*="newSessionLabelMask"], [class*="newSessionShortcut"]')) {
      el.removeAttribute("data-beam-icon");
      el.removeAttribute("data-beam-icon-state");
      el.style.removeProperty("-webkit-mask");
      el.style.removeProperty("mask");
      el.style.removeProperty("background");
      el.style.removeProperty("background-color");
    }
  };
  const beamTagIcons = () => {
    beamStripNewSessionIconHosts();
`,
    );
  } else {
    // Strengthen existing strip
    html = html.replace(
      /const beamStripNewSessionIconHosts = \(\) => \{[\s\S]*?\n  \};/,
      `const beamStripNewSessionIconHosts = () => {
    for (const el of document.querySelectorAll('[class*="newSessionLabel"], [class*="newSessionContent"], [class*="newSessionLabelMask"], [class*="newSessionShortcut"]')) {
      el.removeAttribute("data-beam-icon");
      el.removeAttribute("data-beam-icon-state");
      try {
        el.style.setProperty("-webkit-mask", "none", "important");
        el.style.setProperty("mask", "none", "important");
        el.style.setProperty("mask-image", "none", "important");
        el.style.setProperty("-webkit-mask-image", "none", "important");
        el.style.setProperty("background", "transparent", "important");
        el.style.setProperty("background-color", "transparent", "important");
        el.style.setProperty("width", "auto", "important");
        el.style.setProperty("height", "auto", "important");
        el.style.setProperty("min-width", "0", "important");
        el.style.setProperty("min-height", "0", "important");
        el.style.setProperty("font-size", "14px", "important");
        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("color", "inherit", "important");
        el.style.setProperty("overflow", "visible", "important");
        el.style.setProperty("max-width", "200px", "important");
      } catch {}
    }
  };`,
    );
  }

  // Ensure beamTagIcons calls strip first
  if (html.includes("const beamTagIcons") && !html.includes("beamStripNewSessionIconHosts();\n    beamStripWorkspaceFolderTags")) {
    html = html.replace(
      /const beamTagIcons = \(\) => \{\s*(?:beamStripNewSessionIconHosts\(\);\s*)?/,
      `const beamTagIcons = () => {
    beamStripNewSessionIconHosts();
`,
    );
  }

  // Never include [class*='newSession'] in tag selector (labels are not icon hosts)
  html = html.replace(
    /document\.querySelectorAll\("button, \[role='button'\], \[class\*='panelGlyph'\], \[class\*='iconButton'\], \[class\*='newSession'\]"\)/g,
    `document.querySelectorAll("button, [role='button'], [class*='panelGlyph'], [class*='iconButton']")`,
  );

  // Runtime text rewrite: workspace → project (locale-aware)
  if (!html.includes("beamRewriteProjectWording")) {
    const inject = `
  const beamRewriteProjectWording = () => {
    try {
      const loc = (document.documentElement.lang || localStorage.getItem('beam-locale') || localStorage.getItem('locale') || 'ru').toLowerCase();
      const ru = loc.startsWith('ru');
      const pairs = ru ? [
        [/Выбрать рабочую область/g, 'Выбрать проект'],
        [/Запись в рабочую область/g, 'Запись в проект'],
        [/Загрузка рабочих областей…?/g, 'Загрузка проектов…'],
        [/Добавить рабочую область…?/g, 'Добавить проект…'],
        [/рабочие области/gi, 'проекты'],
        [/рабочую область/gi, 'проект'],
        [/рабочей области/gi, 'проекта'],
        [/рабочих областей/gi, 'проектов'],
        [/Рабочая область/g, 'Проект'],
        [/Loading workspaces…?/gi, 'Загрузка проектов…'],
        [/Add workspace…?/gi, 'Добавить проект…'],
        [/Choose workspace/gi, 'Выбрать проект'],
        [/Select workspace/gi, 'Выбрать проект'],
        [/Workspace Write/gi, 'Запись в проект'],
      ] : [
        [/Выбрать рабочую область/g, 'Choose project'],
        [/Запись в рабочую область/g, 'Project write'],
        [/Загрузка рабочих областей…?/g, 'Loading projects…'],
        [/Добавить рабочую область…?/g, 'Add project…'],
        [/Loading workspaces…?/gi, 'Loading projects…'],
        [/Add workspace…?/gi, 'Add project…'],
        [/Choose workspace/gi, 'Choose project'],
        [/Select workspace/gi, 'Choose project'],
        [/Workspace Write/gi, 'Project write'],
        [/\\bWorkspaces\\b/g, 'Projects'],
        [/\\bWorkspace\\b/g, 'Project'],
      ];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (w.nextNode()) nodes.push(w.currentNode);
      for (const n of nodes) {
        if (!n.nodeValue || n.nodeValue.length > 180) continue;
        if (n.parentElement?.closest?.('script,style,textarea,input,code,pre,[contenteditable=true],#beam-auth-gate')) continue;
        let v = n.nodeValue;
        let changed = false;
        for (const [re, to] of pairs) {
          if (re.test(v)) { re.lastIndex = 0; v = v.replace(re, to); changed = true; }
        }
        if (changed) n.nodeValue = v;
      }
    } catch {}
  };
`;
    // Hook into run() if present
    if (html.includes("hideCustomChrome(root)")) {
      html = html.replace("hideCustomChrome(root);", "hideCustomChrome(root);\n      beamRewriteProjectWording();");
    }
    if (html.includes("beamScrubProviderChrome()")) {
      html = html.replace("beamScrubProviderChrome();", "beamScrubProviderChrome();\n    beamRewriteProjectWording();");
    }
    // Insert function near other beam* helpers
    if (html.includes("const beamScrubProviderChrome")) {
      html = html.replace("const beamScrubProviderChrome", inject + "\n  const beamScrubProviderChrome");
    } else if (html.includes("const beamTagIcons")) {
      html = html.replace("const beamTagIcons", inject + "\n  const beamTagIcons");
    }
  }

  // Strengthen hideCustomChrome for RU labels too
  if (html.includes("hideCustomChrome") && !html.includes("Свой API моделей")) {
    html = html.replace(
      /\^Custom model API\$\/i\.test\(t\) \|\| \^Add model provider\$\/i\.test\(t\) \|\| \^Third-party model provider\$\/i\.test\(t\)/,
      `/^Custom model API$/i.test(t) || /^Add model provider$/i.test(t) || /^Third-party model provider$/i.test(t) || /^Свой API моделей$/i.test(t) || /^Сторонний провайдер$/i.test(t) || /^Advanced \\(hidden\\)$/i.test(t)`,
    );
  }

  // Early locale bootstrap already present — ensure ru default flash-free
  if (!html.includes('id="beam-locale-bootstrap"')) {
    const boot = `<script id="beam-locale-bootstrap">
(() => {
  try {
    const saved = localStorage.getItem('beam-locale') || localStorage.getItem('locale') || localStorage.getItem('dsh.locale');
    const nav = (navigator.language || 'ru').toLowerCase();
    const loc = (saved || (nav.startsWith('en') ? 'en' : 'ru')).toLowerCase().startsWith('en') ? 'en' : 'ru';
    document.documentElement.lang = loc;
    document.documentElement.setAttribute('data-locale', loc);
    try { localStorage.setItem('beam-locale', loc); } catch {}
  } catch {}
})();
</script>`;
    html = html.replace("<head>", "<head>\n" + boot);
  }

  if (html !== orig) {
    summary.htmlFixes++;
    return writeIfChanged(htmlPath, html);
  }
  return false;
}

function patchModelsSettings(file) {
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  n += applyPairs(file, [
    [
      'intro: "Enter your API keys to use models from the following providers."',
      'intro: "Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed."',
    ],
    [
      'intro: "Weekly limits for Tide, Flare and Pine. ASSISTIX ID handles access — no API keys."',
      'intro: "Beam Agent models — Tide, Flare and Pine. ASSISTIX ID handles access; no API keys needed."',
    ],
    ['add: "Add model provider"', 'add: "Advanced (hidden)"'],
    ['addCatalog: "Third-party model provider"', 'addCatalog: "Advanced (hidden)"'],
    ['addCustom: "Custom model API"', 'addCustom: "Advanced (hidden)"'],
    [
      'onboardingTitle: "Add an API key to get started"',
      'onboardingTitle: "Sign in with ASSISTIX ID to use Tide, Flare and Pine"',
    ],
    ['"addCatalog": "Сторонний провайдер моделей"', '"addCatalog": "Скрыто"'],
    ['"addCustom": "Свой API моделей"', '"addCustom": "Скрыто"'],
    ['"add": "Добавить провайдера моделей"', '"add": "Скрыто"'],
    [
      '"intro": "Введите API-ключи, чтобы использовать модели следующих провайдеров."',
      '"intro": "Модели Beam Agent — Tide, Flare и Pine. Доступ через ASSISTIX ID; API-ключи не нужны."',
    ],
  ]);
  if (n) summary.providerHides += n;
  return n;
}

function ensureNoBeamBaseUrlInEnv() {
  const envPath = path.join(process.env.USERPROFILE || "", ".beam", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  const kept = [];
  let removed = false;
  for (const line of lines) {
    if (/^\s*BEAM_BASE_URL\s*=/.test(line)) {
      removed = true;
      continue;
    }
    kept.push(line);
  }
  if (removed) {
    fs.writeFileSync(envPath, kept.join("\n").replace(/\n+$/, "\n"));
    console.log("  removed BEAM_BASE_URL from ~/.beam/.env");
  }
}

console.log("Beam P0 UI polish — trees:", TREES.length);
for (const tree of TREES) {
  console.log("\n==", tree);
  summary.trees.push(tree);
  const assistix = path.join(tree, "beam", "node_modules", "@assistix");
  const webDist = path.join(assistix, "beam-web-frontend", "dist");

  walkClientJs(assistix, (file) => {
    const a = patchLocaleFile(file);
    summary.workspacePairs += a;
  });

  const models = path.join(assistix, "beam-client-ui-settings-models", "lib", "client.js");
  patchModelsSettings(models);

  // Explicit high-value packs
  for (const pkg of [
    "beam-client-ui-workspace",
    "beam-client-ui-conversation",
    "beam-client-ui-sidebar",
    "beam-agent-preset",
    "beam-client-ui-composer",
    "beam-client-ui-settings-models",
    "beam-client-ui-settings-shell",
    "beam-client-locale",
  ]) {
    for (const name of ["client.js", "index.js"]) {
      const f = path.join(assistix, pkg, "lib", name);
      if (fs.existsSync(f)) {
        summary.workspacePairs += applyPairs(f, WORKSPACE_TO_PROJECT);
        patchLocaleFile(f);
      }
    }
  }

  if (fs.existsSync(webDist)) {
    patchOverrideCss(webDist);
    patchIndexHtml(webDist);
  }

  // Also patch app lib main locale resolve if present (flash-free ru)
  const mainJs = path.join(tree, "lib", "main.js");
  if (fs.existsSync(mainJs)) {
    let s = fs.readFileSync(mainJs, "utf8");
    if (s.includes("function resolveDesktopLocale") && !s.includes("const primary = String(locale")) {
      // leave existing fixed resolver alone
    }
  }
}

ensureNoBeamBaseUrlInEnv();

console.log("\n✓ beam-p0-ui-polish done");
console.log(JSON.stringify({
  trees: summary.trees.length,
  filesTouched: summary.filesTouched.length,
  workspacePairs: summary.workspacePairs,
  i18nPairs: summary.i18nPairs,
  cssFixes: summary.cssFixes,
  htmlFixes: summary.htmlFixes,
  providerHides: summary.providerHides,
  sampleFiles: summary.filesTouched.slice(0, 25),
}, null, 2));
