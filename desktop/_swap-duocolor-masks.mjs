/**
 * Make coolicons duocolor/round visible under CSS masks.
 *
 * Chromium mask-image ignores pure stroke SVGs. We rasterize each duocolor
 * SVG (black on transparent, preserving stroke-opacity) with sharp, then wrap
 * the PNG in a tiny SVG so existing `url(.../beam-icons/{bold,fill}/*.svg)`
 * mask rules keep working — secondary paths at 0.4 alpha remain duocolor.
 *
 * Also hardens titlebar New Chat (::before paint) so the control can't go blank.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sharp = require(path.join(
  ROOT,
  "dist/Beam Agent/resources/app/beam/node_modules/sharp"
));

const COOL = path.join(ROOT, "desktop/_coolicons_svg/package");
const DUO = path.join(COOL, "duocolor/round");
const FILL = path.join(COOL, "fill/round");
const LINE = path.join(COOL, "line/round");

const ICON_DIRS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons"),
];

const CSS_PATHS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css"),
];

const HTML_PATHS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"),
];

const CACHE_BUST = "coolicons-duocolor-round-mask1";

/** beam filename → coolicons basename */
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
  "window-sidebar": "window-sidebar",
  "more-grid": "more-grid",
  "more-horizontal": "more-horizontal",
  "slider-2": "slider-2",
  "chevron-down": "chevron-down",
  "external-link": "external-link",
  "arrow-up": "arrow-up",
};

const maskCache = new Map(); // abs cool path → mask svg string

function resolveCool(name, preferred = DUO) {
  const candidates = [name, ALIAS[name], name.replace(/_/g, "-")].filter(Boolean);
  for (const c of [...candidates]) {
    if (c.endsWith("-small")) candidates.push(c.replace(/-small$/, ""));
  }
  for (const dir of [preferred, DUO, FILL, LINE]) {
    for (const c of candidates) {
      const p = path.join(dir, `${c}.svg`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function toMaskSvg(srcPath) {
  if (maskCache.has(srcPath)) return maskCache.get(srcPath);
  let svg = fs.readFileSync(srcPath, "utf8");
  // Mask luminance/alpha: force black ink, keep stroke-opacity for duocolor
  svg = svg
    .replace(/currentColor/gi, "#000000")
    .replace(/stroke="white"/gi, 'stroke="#000000"')
    .replace(/fill="white"/gi, 'fill="#000000"');
  if (!/viewBox=/.test(svg) && /width="24"/.test(svg)) {
    svg = svg.replace("<svg", '<svg viewBox="0 0 24 24"');
  }
  const png = await sharp(Buffer.from(svg), { density: 384 })
    .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const b64 = png.toString("base64");
  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><image href="data:image/png;base64,${b64}" width="24" height="24" preserveAspectRatio="xMidYMid meet"/></svg>\n`;
  maskCache.set(srcPath, out);
  return out;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function swapDir(iconsRoot) {
  const boldDir = path.join(iconsRoot, "bold");
  const fillDir = path.join(iconsRoot, "fill");
  fs.mkdirSync(boldDir, { recursive: true });
  fs.mkdirSync(fillDir, { recursive: true });

  const duoNames = fs.readdirSync(DUO).filter((f) => f.endsWith(".svg")).map((f) => f.replace(/\.svg$/, ""));
  const existing = new Set([
    ...fs.readdirSync(boldDir).filter((f) => f.endsWith(".svg")).map((f) => f.replace(/\.svg$/, "")),
    ...fs.readdirSync(fillDir).filter((f) => f.endsWith(".svg")).map((f) => f.replace(/\.svg$/, "")),
    ...Object.keys(ALIAS),
    ...Object.values(ALIAS),
    ...duoNames,
  ]);

  const names = [...existing];
  let wrote = 0;
  let missing = 0;

  await mapPool(names, 8, async (name) => {
    const src = resolveCool(name, DUO);
    if (!src) {
      missing++;
      return;
    }
    const maskSvg = await toMaskSvg(src);
    fs.writeFileSync(path.join(boldDir, `${name}.svg`), maskSvg);
    fs.writeFileSync(path.join(fillDir, `${name}.svg`), maskSvg);
    const coolName = path.basename(src, ".svg");
    if (coolName !== name) {
      fs.writeFileSync(path.join(boldDir, `${coolName}.svg`), maskSvg);
      fs.writeFileSync(path.join(fillDir, `${coolName}.svg`), maskSvg);
    }
    wrote++;
  });

  // Critical chrome aliases
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
    plus: "plus",
    settings: "settings",
    "window-sidebar": "window-sidebar",
  };
  for (const [from, to] of Object.entries(forceAlias)) {
    const src = resolveCool(to, DUO);
    if (!src) continue;
    const maskSvg = await toMaskSvg(src);
    fs.writeFileSync(path.join(boldDir, `${from}.svg`), maskSvg);
    fs.writeFileSync(path.join(fillDir, `${from}.svg`), maskSvg);
  }

  fs.writeFileSync(
    path.join(iconsRoot, "map.json"),
    JSON.stringify(
      {
        source: "coolicons-5.4.0",
        bold: "duocolor/round → mask-safe (sharp PNG embed)",
        fill: "duocolor/round → mask-safe (sharp PNG embed)",
        note: "Stroke duocolor is invisible as CSS masks; each file is a 64px PNG alpha wrap preserving duocolor opacities.",
        alias: ALIAS,
        wrote,
        missing,
        duoCount: duoNames.length,
        boldCount: fs.readdirSync(boldDir).filter((f) => f.endsWith(".svg")).length,
      },
      null,
      2
    )
  );

  return {
    wrote,
    missing,
    boldCount: fs.readdirSync(boldDir).filter((f) => f.endsWith(".svg")).length,
  };
}

const CHROME_CSS = `
/* ===== BEAM duocolor chrome harden (newSession titlebar) ===== */
/* Paint New Chat via ::before so opacity:0 path tricks can't blank the titlebar slot */
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession,
[data-windows-titlebar] .wtg9ga_collapsed button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  opacity: 1 !important;
  visibility: visible !important;
  color: var(--dsw-alias-label-secondary, #c5cdca) !important;
  overflow: visible !important;
}
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession::before,
[data-windows-titlebar] .wtg9ga_collapsed button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"])::before {
  content: "" !important;
  display: block !important;
  width: 16px !important;
  height: 16px !important;
  flex: none !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: none !important;
}
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession svg,
[data-windows-titlebar] .wtg9ga_collapsed button[class*="newSession"] svg {
  position: absolute !important;
  width: 0 !important;
  height: 0 !important;
  min-width: 0 !important;
  min-height: 0 !important;
  opacity: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
}
/* Sidebar (expanded / non-titlebar) newSession glyph — mask on SVG host */
button.wtg9ga_newSession svg,
button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]) svg,
.wtg9ga_newSessionContent > svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  flex: none !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
button.wtg9ga_newSession svg *,
button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]) svg *,
.wtg9ga_newSessionContent > svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
/* Gear host */
#beam-side-limits .bsl-gear .bsl-gear-ico {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
  flex: none !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
  opacity: 1 !important;
  visibility: visible !important;
}
#beam-side-limits .bsl-gear svg { display: none !important; }
/* Titlebar sidebar toggle — duocolor mask */
[data-windows-titlebar] .wtg9ga_toggle svg,
[data-windows-titlebar] button.wtg9ga_toggle svg,
.wtg9ga_toggle .wtg9ga_panelIcon,
.wtg9ga_toggle svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/window-sidebar.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/window-sidebar.svg") center / contain no-repeat !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
[data-windows-titlebar] .wtg9ga_toggle svg *,
[data-windows-titlebar] button.wtg9ga_toggle svg *,
.wtg9ga_toggle .wtg9ga_panelIcon *,
.wtg9ga_toggle svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
`;

function patchCss(css) {
  let s = css;
  // Remove prior harden blocks to avoid stacking duplicates
  s = s.replace(/\n?\/\* ===== BEAM gear ico host fix ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g, "\n");
  s = s.replace(/\n?\/\* ===== BEAM newSession mask harden ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g, "\n");
  s = s.replace(/\n?\/\* ===== BEAM duocolor chrome harden \(newSession titlebar\) ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g, "\n");

  // Ensure gear block isn't empty
  if (s.includes("#beam-side-limits .bsl-gear .bsl-gear-ico")) {
    s = s.replace(
      /#beam-side-limits \.bsl-gear \.bsl-gear-ico \{[^}]*\}/g,
      `#beam-side-limits .bsl-gear .bsl-gear-ico {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
  flex: none !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.svg") center / contain no-repeat !important;
}`
    );
  }

  // Restore emptied newSession sizing block masks (comments-only residue)
  s = s.replace(
    /(button\.wtg9ga_newSession > svg,\s*button\.wtg9ga_newSession svg,\s*button\[class\*="newSession"\] > svg,\s*button\[class\*="newSession"\] svg \{[\s\S]*?color: inherit !important;\s*)(?:\/\* \*\/\s*)+/g,
    `$1background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
`
  );

  if (!s.includes("BEAM duocolor chrome harden")) {
    s = s.trimEnd() + "\n" + CHROME_CSS + "\n";
  }
  return s;
}

function bustHtml(html) {
  return html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE_BUST}"`
  );
}

if (!fs.existsSync(DUO)) {
  console.error("Missing duocolor round at", DUO);
  process.exit(1);
}

console.log("Converting duocolor → mask-safe SVG via sharp…");
for (const dir of ICON_DIRS) {
  if (!fs.existsSync(dir)) {
    console.log("skip icons", path.relative(ROOT, dir));
    continue;
  }
  const r = await swapDir(dir);
  console.log("icons", path.relative(ROOT, dir), r);
}

for (const cssPath of CSS_PATHS) {
  if (!fs.existsSync(cssPath)) continue;
  const after = patchCss(fs.readFileSync(cssPath, "utf8"));
  fs.writeFileSync(cssPath, after);
  console.log(
    "css",
    path.relative(ROOT, cssPath),
    "chrome",
    after.includes("BEAM duocolor chrome harden"),
    "plusMask",
    after.includes('beam-icons/bold/plus.svg')
  );
}

for (const htmlPath of HTML_PATHS) {
  if (!fs.existsSync(htmlPath)) continue;
  fs.writeFileSync(htmlPath, bustHtml(fs.readFileSync(htmlPath, "utf8")));
  console.log("html", path.relative(ROOT, htmlPath), CACHE_BUST);
}

console.log("DONE duocolor mask swap", { cached: maskCache.size, bust: CACHE_BUST });
