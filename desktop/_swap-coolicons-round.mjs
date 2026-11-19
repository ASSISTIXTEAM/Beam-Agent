/**
 * Direct SVG file swap: beam-icons/{bold,fill} ← coolicons {duocolor,fill}/round
 * No DOM injectors. Also restores gear mask CSS that left empty chrome.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COOL = path.join(ROOT, "desktop/_coolicons_svg/package");
const DUO = path.join(COOL, "duocolor/round");
const FILL = path.join(COOL, "fill/round");
const LINE = path.join(COOL, "line/round");

const ICON_DIRS = [
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons"),
  path.join("C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons"),
  path.join("C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons"),
];

const CSS_PATHS = [
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"),
  path.join("C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  path.join("C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"),
];

const HTML_PATHS = [
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join("C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join("C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
];

/** beam filename (no .svg) → coolicons 5.4 real names */
const ALIAS = {
  clip: "paperclip",
  attach: "paperclip",
  apps: "grid",
  "apps-add": "more-grid",
  "grid-add": "more-grid",
  plugins: "grid",
  workspace: "folder",
  "menu-dots": "more-horizontal",
  more: "more-horizontal",
  refresh: "reload",
  update: "reload",
  "sign-out": "log-out",
  "sign-in": "log-in",
  logout: "log-out",
  login: "log-in",
  edit: "pencil",
  cross: "close",
  "cross-small": "close",
  "angle-down": "chevron-down",
  "angle-up": "chevron-up",
  "angle-left": "chevron-left",
  "angle-right": "chevron-right",
  document: "file-text",
  comment: "chat",
  home: "house",
  bulb: "bulb",
  lightbulb: "bulb",
  magic: "sparkle",
  "magic-wand": "sparkle",
  interactive: "hand",
  list: "list-unordered",
  "data-transfer": "arrow-left-right",
  "plus-small": "plus",
  "folder-add": "folder-plus",
  "settings-sliders": "slider-2",
  "sliders-horizontal": "slider-2",
  send: "paper-plane",
  "chat-plus": "chat-plus",
  "new-chat": "chat-plus",
  "message-plus": "chat-plus",
  panel: "window-sidebar",
  "panel-left": "window-sidebar",
  "sidebar-left": "window-sidebar",
  "panel-right": "window-sidebar-right",
  "sidebar-right": "window-sidebar-right",
  collapse: "window-sidebar",
  maximize: "expand",
  fullscreen: "expand",
  expand: "expand",
  "layout-dashboard": "window",
  dashboard: "window",
  "layout-columns": "window",
  columns: "window",
  split: "window",
  recycle: "reload",
  power: "power",
  "cloud-up": "cloud-upload",
  "cloud-upload": "cloud-upload",
  "add-project": "folder-plus",
  "folder-plus": "folder-plus",
  options: "more-horizontal",
  pin: "pin",
  archive: "archive",
  mic: "microphone",
  microphone: "microphone",
  gauge: "activity",
  limits: "activity",
  model: "cpu",
  chip: "cpu",
  sparkle: "sparkle",
  "open-right": "external-link",
  "new-tab": "external-link",
  brain: "brain",
  bot: "robot",
  agent: "robot",
  alarm: "bell",
  api: "code",
  "archive-restore": "archive",
  automation: "clock",
  brackets: "code",
  "chart-bar": "activity",
  "chart-bar-vertical": "activity",
  "chevrons-down": "chevron-down",
  "chevron-double-down": "chevron-down",
  "circle-close": "circle-close",
  "circle-x": "circle-close",
  "circle-warning": "circle-warning",
  "circle-alert": "circle-warning",
  "file-download": "file-download",
  "file-down": "file-download",
  "list-unordered": "list-unordered",
  "log-in": "log-in",
  "log-out": "log-out",
  pencil: "pencil",
  reload: "reload",
  "file-text": "file-text",
  rocket: "rocket",
  upload: "upload",
  download: "download",
  file: "file",
  trash: "trash",
  check: "check",
  close: "close",
  copy: "copy",
  share: "share",
  bell: "bell",
  user: "user",
  search: "search",
  settings: "settings",
  folder: "folder",
  clock: "clock",
  grid: "grid",
  plus: "plus",
  "paper-plane": "paper-plane",
  "arrow-up": "arrow-up",
  "arrow-left-right": "arrow-left-right",
  paperclip: "paperclip",
  chat: "chat",
  house: "house",
  "thumbs-up": "thumbs-up",
  "thumbs-down": "thumbs-down",
  eye: "eye",
  "eye-off": "eye-off",
  hand: "hand",
  code: "code",
  database: "database",
  "circle-check": "circle-check",
  "circle-help": "circle-help",
  "circle-info": "circle-info",
  "circle-pause": "circle-pause",
  "circle-play": "circle-play",
};

function resolveCool(name, styleDir) {
  const candidates = [
    name,
    ALIAS[name],
    name.replace(/_/g, "-"),
  ].filter(Boolean);
  // also try without trailing variants
  for (const c of [...candidates]) {
    if (c.endsWith("-small")) candidates.push(c.replace(/-small$/, ""));
  }
  for (const c of candidates) {
    const p = path.join(styleDir, `${c}.svg`);
    if (fs.existsSync(p)) return p;
  }
  // fallback line if style missing
  if (styleDir !== LINE) {
    for (const c of candidates) {
      const p = path.join(LINE, `${c}.svg`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function normalizeSvg(svg) {
  // Keep currentColor; ensure viewBox for mask sizing
  let s = svg;
  if (!/viewBox=/.test(s) && /width="24"/.test(s)) {
    s = s.replace("<svg", '<svg viewBox="0 0 24 24"');
  }
  return s;
}

function swapDir(iconsRoot) {
  const boldDir = path.join(iconsRoot, "bold");
  const fillDir = path.join(iconsRoot, "fill");
  fs.mkdirSync(boldDir, { recursive: true });
  fs.mkdirSync(fillDir, { recursive: true });

  // Also vendor full coolicons round sets for completeness
  const vendorDuo = path.join(iconsRoot, "coolicons/duocolor-round");
  const vendorFill = path.join(iconsRoot, "coolicons/fill-round");
  if (!fs.existsSync(vendorDuo)) {
    fs.cpSync(DUO, vendorDuo, { recursive: true });
  }
  if (!fs.existsSync(vendorFill)) {
    fs.cpSync(FILL, vendorFill, { recursive: true });
  }

  const names = new Set([
    ...fs.readdirSync(boldDir).filter((f) => f.endsWith(".svg")).map((f) => f.replace(/\.svg$/, "")),
    ...fs.readdirSync(fillDir).filter((f) => f.endsWith(".svg")).map((f) => f.replace(/\.svg$/, "")),
    ...Object.keys(ALIAS),
    ...Object.values(ALIAS),
  ]);

  let replaced = 0;
  let missing = [];
  // CSS masks need solid filled shapes — stroke duocolor renders empty as masks.
  // bold + fill both get fill/round (rounded solid). Duocolor kept under coolicons/ for reference.
  for (const name of names) {
    const fillSrc = resolveCool(name, FILL) || resolveCool(name, DUO) || resolveCool(name, LINE);
    if (!fillSrc) {
      missing.push(name);
      continue;
    }
    const solid = normalizeSvg(fs.readFileSync(fillSrc, "utf8"));
    fs.writeFileSync(path.join(boldDir, `${name}.svg`), solid);
    fs.writeFileSync(path.join(fillDir, `${name}.svg`), solid);
    const coolName = path.basename(fillSrc, ".svg");
    if (coolName !== name) {
      fs.writeFileSync(path.join(boldDir, `${coolName}.svg`), solid);
      fs.writeFileSync(path.join(fillDir, `${coolName}.svg`), solid);
    }
    replaced++;
  }

  // Critical chrome icons — force write even if not previously present
  for (const must of [
    "plus", "settings", "paperclip", "search", "folder", "grid", "clock",
    "more-horizontal", "paper-plane", "log-out", "reload", "user", "chevron-down",
    "chat-plus", "slider-2", "window-sidebar", "microphone", "bulb", "more-grid",
  ]) {
    const fillSrc = resolveCool(must, FILL) || resolveCool(must, DUO);
    if (!fillSrc) continue;
    const solid = normalizeSvg(fs.readFileSync(fillSrc, "utf8"));
    fs.writeFileSync(path.join(boldDir, `${must}.svg`), solid);
    fs.writeFileSync(path.join(fillDir, `${must}.svg`), solid);
  }
  // alias files that CSS still points at
  const forceAlias = {
    clip: "paperclip",
    apps: "grid",
    "apps-add": "more-grid",
    "grid-add": "more-grid",
    "menu-dots": "more-horizontal",
    refresh: "reload",
    "sign-out": "log-out",
    "sign-in": "log-in",
    edit: "pencil",
    cross: "close",
    "cross-small": "close",
    "plus-small": "plus",
    "settings-sliders": "slider-2",
    "sliders-horizontal": "slider-2",
    "new-chat": "chat-plus",
    "message-plus": "chat-plus",
    "chat-plus": "chat-plus",
    panel: "window-sidebar",
    "panel-left": "window-sidebar",
    "sidebar-left": "window-sidebar",
    mic: "microphone",
    microphone: "microphone",
    bulb: "bulb",
    lightbulb: "bulb",
  };
  for (const [from, to] of Object.entries(forceAlias)) {
    const fillSrc = resolveCool(to, FILL) || resolveCool(to, DUO);
    if (!fillSrc) continue;
    const solid = normalizeSvg(fs.readFileSync(fillSrc, "utf8"));
    fs.writeFileSync(path.join(boldDir, `${from}.svg`), solid);
    fs.writeFileSync(path.join(fillDir, `${from}.svg`), solid);
  }

  fs.writeFileSync(
    path.join(iconsRoot, "map.json"),
    JSON.stringify(
      {
        source: "coolicons-5.4.0",
        bold: "fill/round (solid for CSS masks)",
        fill: "fill/round",
        note: "duocolor/round is stroke-based and invisible as CSS masks; vendor copy kept under coolicons/",
        alias: ALIAS,
        replaced,
        missing: missing.filter((m, i, a) => a.indexOf(m) === i).slice(0, 80),
      },
      null,
      2
    )
  );
  return { replaced, missing: missing.length, boldCount: fs.readdirSync(boldDir).filter((f) => f.endsWith(".svg")).length };
}

function fixGearCss(css) {
  let s = css;
  // Restore gear icon mask on .bsl-gear-ico (was emptied to comments)
  const gearBlock = `#beam-side-limits .bsl-gear .bsl-gear-ico {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
  flex: none !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
}`;
  if (s.includes("#beam-side-limits .bsl-gear .bsl-gear-ico")) {
    s = s.replace(
      /#beam-side-limits \.bsl-gear \.bsl-gear-ico \{[^}]*\}/g,
      gearBlock
    );
  } else {
    s += "\n" + gearBlock + "\n";
  }

  // Ensure gear button shows the ico host
  if (!s.includes("BEAM gear ico host fix")) {
    s += `
/* ===== BEAM gear ico host fix ===== */
#beam-side-limits .bsl-gear {
  position: relative !important;
}
#beam-side-limits .bsl-gear .bsl-gear-ico {
  opacity: 1 !important;
  visibility: visible !important;
}
#beam-side-limits .bsl-gear svg { display: none !important; }
`;
  }

  // New Session: keep mask on SVG host; ensure size + visible paint host
  if (!s.includes("BEAM newSession mask harden")) {
    s += `
/* ===== BEAM newSession mask harden ===== */
button.wtg9ga_newSession svg,
button[class*="newSession"] svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
button.wtg9ga_newSession svg *,
button[class*="newSession"] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
`;
  }

  return s;
}

function bustHtml(html) {
  return html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=coolicons-fill-round2"'
  );
}

if (!fs.existsSync(DUO) || !fs.existsSync(FILL)) {
  console.error("Missing coolicons package at", COOL);
  process.exit(1);
}

let total = 0;
for (const dir of ICON_DIRS) {
  if (!fs.existsSync(dir)) {
    console.log("skip icons", path.relative(ROOT, dir));
    continue;
  }
  const r = swapDir(dir);
  console.log("icons", path.relative(ROOT, dir), r);
  total += r.replaced;
}

for (const cssPath of CSS_PATHS) {
  if (!fs.existsSync(cssPath)) continue;
  const before = fs.readFileSync(cssPath, "utf8");
  const after = fixGearCss(before);
  fs.writeFileSync(cssPath, after);
  const gearOk = after.includes('bsl-gear-ico') && after.includes('beam-icons/bold/settings.svg') && /bsl-gear-ico \{[^}]*mask:/s.test(after);
  console.log("css", path.relative(ROOT, cssPath), "gearMask", gearOk);
}

for (const htmlPath of HTML_PATHS) {
  if (!fs.existsSync(htmlPath)) continue;
  fs.writeFileSync(htmlPath, bustHtml(fs.readFileSync(htmlPath, "utf8")));
  console.log("html", path.relative(ROOT, htmlPath));
}

console.log("DONE coolicons swap", total);
