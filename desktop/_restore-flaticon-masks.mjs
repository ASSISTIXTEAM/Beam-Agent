/**
 * Restore the working Flaticon mask icon system (pre-coolicons).
 * Stock SVG-only revert left empty chrome because masks + tagging were removed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const WEBS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

function resolveIconFile(assetsDir, file) {
  const bold = path.join(assetsDir, "beam-icons", "bold", `${file}.svg`);
  if (fs.existsSync(bold)) return file;
  // coolicons renames fallback
  const alts = {
    clip: "paperclip",
    apps: "grid",
    "apps-add": "grid",
    "menu-dots": "more-horizontal",
    refresh: "reload",
    "sign-out": "log-out",
    "sign-in": "log-in",
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
    "magic-wand": "sparkle",
    interactive: "hand",
    list: "list-unordered",
    "data-transfer": "arrow-left-right",
    "plus-small": "plus",
    "folder-add": "folder-plus",
    "settings-sliders": "slider",
  };
  const alt = alts[file];
  if (alt && fs.existsSync(path.join(assetsDir, "beam-icons", "bold", `${alt}.svg`))) return alt;
  return file;
}

function buildIconCss(assetsDir) {
  const resolved = {};
  for (const [role, file] of Object.entries(ICON_MAP)) {
    resolved[role] = resolveIconFile(assetsDir, file);
  }

  const lines = [];
  lines.push(`/* ===== BEAM custom icons (flaticon bold/fill → currentColor masks) ===== */`);
  lines.push(`[data-beam-icon] { position: relative !important; }`);

  for (const [role, file] of Object.entries(resolved)) {
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

  lines.push(`
/* Sidebar New Session — icon SVG only; keep label text readable */
.wtg9ga_newSession > span > span > svg,
.wtg9ga_newSessionContent > svg,
button.wtg9ga_newSession svg,
button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]) svg {
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved.plus}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved.plus}.svg") center / contain no-repeat !important;
}
.wtg9ga_newSessionContent > svg *,
button.wtg9ga_newSession svg *,
button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]) svg * {
  opacity: 0 !important; fill: transparent !important; stroke: transparent !important;
}

/* Composer send */
button[aria-label*="Send"] svg,
button[aria-label*="Отправ"] svg,
[class*="sendButton"] svg,
[class*="SendButton"] svg {
  color: #042f2e !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/fill/${resolved.send}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/fill/${resolved.send}.svg") center / contain no-repeat !important;
}
button[aria-label*="Send"] svg *,
button[aria-label*="Отправ"] svg *,
[class*="sendButton"] svg *,
[class*="SendButton"] svg * { opacity: 0 !important; }

/* Attach */
button[aria-label*="Attach"] svg,
button[aria-label*="Прикреп"] svg,
[class*="attach"] svg,
[class*="Attach"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved.attach}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved.attach}.svg") center / contain no-repeat !important;
}
button[aria-label*="Attach"] svg *,
button[aria-label*="Прикреп"] svg *,
[class*="attach"] svg * { opacity: 0 !important; }

/* Search */
button[aria-label*="Search"] svg,
button[aria-label*="Поиск"] svg,
[class*="searchButton"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved.search}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved.search}.svg") center / contain no-repeat !important;
}
button[aria-label*="Search"] svg *,
button[aria-label*="Поиск"] svg * { opacity: 0 !important; }

/* Settings */
button[aria-label*="Settings"] svg,
button[aria-label*="Настрой"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved.settings}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved.settings}.svg") center / contain no-repeat !important;
}
button[aria-label*="Settings"] svg *,
button[aria-label*="Настрой"] svg * { opacity: 0 !important; }

/* Message actions */
button[aria-label*="Copy"] svg, button[aria-label*="Копир"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved.copy}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved.copy}.svg") center / contain no-repeat !important;
}
button[aria-label*="Copy"] svg *, button[aria-label*="Копир"] svg * { opacity: 0 !important; }
button[aria-label*="Share"] svg, button[aria-label*="Подел"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved.share}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved.share}.svg") center / contain no-repeat !important;
}
button[aria-label*="Share"] svg *, button[aria-label*="Подел"] svg * { opacity: 0 !important; }
button[aria-label*="Thumbs up"] svg, button[aria-label*="Нравится"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved["thumbs-up"]}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved["thumbs-up"]}.svg") center / contain no-repeat !important;
}
button[aria-label*="Thumbs up"] svg *, button[aria-label*="Нравится"] svg * { opacity: 0 !important; }
button[aria-label*="Thumbs down"] svg, button[aria-label*="Не нравится"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/${resolved["thumbs-down"]}.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/${resolved["thumbs-down"]}.svg") center / contain no-repeat !important;
}
button[aria-label*="Thumbs down"] svg *, button[aria-label*="Не нравится"] svg * { opacity: 0 !important; }

/* NEVER mask Tide/Flare/Pine usage rings */
button[aria-label*="Tide"] svg,
button[aria-label*="Flare"] svg,
button[aria-label*="Pine"] svg,
button[aria-label*="Limits"] svg,
#beam-side-limits .bsl-chart svg,
#beam-side-limits .bsl-chart svg * {
  -webkit-mask: none !important;
  mask: none !important;
  background: none !important;
  background-color: transparent !important;
  opacity: 1 !important;
}
`);
  lines.push(`/* ===== /BEAM custom icons ===== */`);
  return { css: lines.join("\n"), resolved };
}

function upsertBlock(css, startMarker, endMarker, block) {
  const a = css.indexOf(startMarker);
  const b = css.indexOf(endMarker);
  if (a >= 0 && b > a) {
    return css.slice(0, a) + block + css.slice(b + endMarker.length);
  }
  // also match REVERTED stub
  const stub = css.indexOf("/* ===== BEAM custom icons");
  const stubEnd = css.indexOf("/* ===== /BEAM custom icons ===== */");
  if (stub >= 0 && stubEnd > stub) {
    return css.slice(0, stub) + block + css.slice(stubEnd + "/* ===== /BEAM custom icons ===== */".length);
  }
  return css.trimEnd() + "\n\n" + block + "\n";
}

function fixCss(cssPath, assetsDir) {
  let css = fs.readFileSync(cssPath, "utf8");
  const { css: block, resolved } = buildIconCss(assetsDir);
  css = upsertBlock(
    css,
    "/* ===== BEAM custom icons (flaticon bold/fill → currentColor masks) ===== */",
    "/* ===== /BEAM custom icons ===== */",
    block
  );

  // Kill stock-visibility block that forces mask:none on all button SVGs
  css = css.replace(/\n\/\* ===== BEAM stock icon visibility =====[\s\S]*?(?=\n\/\* =====|$)/, "\n");

  // Soften conflicting newSession currentColor restore if left outside custom block
  css = css.replace(
    /button\.wtg9ga_newSession svg \*,\s*button\[class\*="newSession"\] svg \* \{[^}]*fill:\s*currentColor[^}]*\}/g,
    `/* newSession glyph paint owned by custom icons masks */`
  );

  fs.writeFileSync(cssPath, css);
  return resolved;
}

function fixHtml(html) {
  let h = html;
  // Re-enable tagging
  h = h.replace(
    /const beamTagIcons = \(\) => \{\s*\/\* __beamTagIconsDisabled[\s\S]*?return;\s*/m,
    "const beamTagIcons = () => {\n"
  );

  // Remove untag scrubber
  h = h.replace(/<script id="beam-untag-icons">[\s\S]*?<\/script>\s*/g, "");

  // Never tag gauges / limits rings
  if (!h.includes("__beamSkipGaugeTag")) {
    h = h.replace(
      "if (el.closest(\"#beam-auth-gate,#beam-side-limits\")) continue;",
      `if (el.closest("#beam-auth-gate,#beam-side-limits")) continue;
      /* __beamSkipGaugeTag */
      if (/tide|flare|pine|лимит|limits/i.test(labelOf(el))) continue;`
    );
  }

  h = h.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=flaticonback1"'
  );
  return h;
}

let n = 0;
for (const web of WEBS) {
  const cssPath = path.join(web, "assets/beam-override.css");
  const htmlPath = path.join(web, "index.html");
  const mapPath = path.join(web, "assets/beam-icons/map.json");
  if (!fs.existsSync(cssPath) || !fs.existsSync(htmlPath)) {
    console.log("skip", path.relative(ROOT, web));
    continue;
  }
  const resolved = fixCss(cssPath, path.join(web, "assets"));
  fs.writeFileSync(htmlPath, fixHtml(fs.readFileSync(htmlPath, "utf8")));
  fs.writeFileSync(
    mapPath,
    JSON.stringify({ map: ICON_MAP, resolved, source: "flaticon-restore", missing: [] }, null, 2)
  );
  const css = fs.readFileSync(cssPath, "utf8");
  console.log(
    path.relative(ROOT, web),
    "masks",
    (css.match(/beam-icons\/bold\//g) || []).length,
    "stockVis",
    css.includes("BEAM stock icon visibility"),
    "tagDisabled",
    fs.readFileSync(htmlPath, "utf8").includes("__beamTagIconsDisabled")
  );
  n++;
}
console.log("RESTORED flaticon masks", n);
