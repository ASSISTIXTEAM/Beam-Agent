/**
 * NUCLEAR coolicons install:
 * 1) Kill CSS masks that hide SVG (stroke icons were invisible as masks)
 * 2) Inject inline coolicon SVG into every product icon (<use> and chrome)
 * 3) Replace beam-icons assets with coolicons fill (if any mask left, it works)
 * 4) Old Flaticon/DSH glyph artwork must not remain visible
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = path.join(ROOT, "desktop/vendor/coolicons/icons/svg");
const DUO = path.join(VENDOR, "duocolor/round");
const FILL = path.join(VENDOR, "fill/round");
const LINE = path.join(VENDOR, "line/round");

/** glyph (without -outline/-fill suffix handling) → coolicon name */
const GLYPH_MAP = {
  "agent-preset": "agent",
  "alarm-clock": "alarm",
  api: "api",
  "apps-add": "grid",
  "apps-add-compact": "grid",
  archive: "archive",
  "archive-check": "archive",
  "archive-off": "archive",
  branch: "git-branch",
  browse: "globe",
  "check-circle": "circle-check",
  checklist: "list-check",
  check: "check",
  "chevron-down": "chevron-down",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  "chevrons-up-down": "chevron-double-down",
  "chevron-up": "chevron-up",
  clock: "clock",
  "close-circle": "circle-close",
  close: "close",
  code: "code",
  compact: "shrink",
  "compare-split": "columns",
  "context-injection": "file-download",
  copy: "copy",
  "cordis-plugin": "puzzle",
  dark: "moon",
  database: "database",
  data: "chart-bar-vertical",
  "deliver-doc": "file-text",
  dislike: "thumbs-down",
  download: "download",
  "drag-handle": "menu-alt-2",
  edit: "pencil",
  ellipsis: "more-horizontal",
  enhance: "text-align-left",
  "eye-off": "eye-off",
  eye: "eye",
  "flat-list": "list-unordered",
  "folder-close": "folder",
  "folder-open": "folder-open",
  followsystem: "monitor",
  fullscreen: "expand",
  gauge: "gauge",
  globe: "globe",
  goal: "target",
  info: "circle-info",
  inspect: "brackets",
  layers: "layers",
  light: "sun",
  like: "thumbs-up",
  link: "link",
  "list-pen": "note-edit",
  loading: "loading",
  "mail-read": "mail-open",
  "mail-unread": "mail",
  microphone: "microphone",
  "new-chat": "chat-plus",
  nowrap: "text-wrap",
  "panel-left": "panel-left",
  paperclip: "paperclip",
  "paper-plane": "paper-plane",
  pause: "circle-pause",
  personalization: "slider-2",
  pin: "pin",
  plan: "map",
  play: "circle-play",
  "plugin-pinwheel": "puzzle",
  plus: "plus",
  "project-add": "folder-plus",
  question: "circle-help",
  queue: "list-unordered",
  refresh: "reload",
  "right-up": "arrow-up-right",
  save: "save",
  search: "search",
  send: "arrow-up",
  settings: "settings",
  share: "share",
  shield: "shield",
  skill: "sparkle",
  "sliders-two": "slider-2",
  sparkle: "sparkle",
  stop: "stop",
  think: "brain",
  trash: "trash",
  "tree-corner": "arrow-down-right",
  "triangle-right": "play",
  unarchive: "archive-restore",
  upload: "upload",
  user: "user",
  users: "users",
  warning: "circle-warning",
  "warning-triangle": "triangle-warning",
  "workspace-tree": "list-tree",
  wrap: "text-wrap",
  "wrap-lines": "text-wrap",
};

const ROLE_MAP = {
  plus: "plus",
  "plus-small": "plus",
  send: "paper-plane",
  "arrow-up": "arrow-up",
  attach: "paperclip",
  paperclip: "paperclip",
  plugins: "grid",
  apps: "grid",
  "apps-add": "grid",
  automation: "clock",
  clock: "clock",
  more: "more-horizontal",
  grid: "grid",
  workspace: "folder",
  folder: "folder",
  "folder-add": "folder-plus",
  search: "search",
  refresh: "reload",
  update: "reload",
  logout: "log-out",
  login: "log-in",
  settings: "settings",
  "settings-sliders": "slider-2",
  copy: "copy",
  share: "share",
  "thumbs-up": "thumbs-up",
  "thumbs-down": "thumbs-down",
  bell: "bell",
  edit: "pencil",
  trash: "trash",
  check: "check",
  cross: "close",
  "cross-small": "close",
  "angle-down": "chevron-down",
  "angle-up": "chevron-up",
  "angle-left": "chevron-left",
  "angle-right": "chevron-right",
  user: "user",
  document: "file-text",
  file: "file",
  upload: "upload",
  download: "download",
  comment: "chat",
  home: "house",
  bulb: "bulb",
  rocket: "rocket",
  magic: "sparkle",
  interactive: "hand",
  list: "list-unordered",
  dashboard: "dashboard",
  recycle: "recycle",
  power: "power",
  "data-transfer": "arrow-left-right",
  "cloud-upload": "cloud-upload",
  microphone: "microphone",
  panel: "panel-left",
  "new-chat": "chat-plus",
};

function readCool(name, prefer = "duo") {
  const order =
    prefer === "fill"
      ? [FILL, DUO, LINE]
      : prefer === "line"
        ? [LINE, DUO, FILL]
        : [DUO, LINE, FILL];
  for (const dir of order) {
    const p = path.join(dir, `${name}.svg`);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return null;
}

function normalizeInline(svg) {
  let s = String(svg).trim();
  s = s.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/viewBox=/.test(s)) s = s.replace("<svg", '<svg viewBox="0 0 24 24"');
  // ensure inherits size from host
  s = s.replace(
    /<svg\b/,
    '<svg width="100%" height="100%" style="display:block;width:1em;height:1em"'
  );
  return s;
}

function glyphFromDataIcon(id) {
  // dsw-icon-new-chat-outline-regular → new-chat
  const m = String(id || "").match(/^dsw-icon-(.+)-(regular|medium)$/);
  if (!m) return null;
  let g = m[1];
  g = g.replace(/-outline$/, "").replace(/-fill$/, "");
  return g;
}

function buildPayload() {
  const byGlyph = {};
  const byRole = {};
  const bySymbol = {};
  const missing = [];

  for (const [glyph, cool] of Object.entries(GLYPH_MAP)) {
    const raw = readCool(cool, "duo");
    if (!raw) {
      missing.push(`glyph:${glyph}->${cool}`);
      continue;
    }
    const markup = normalizeInline(raw);
    byGlyph[glyph] = markup;
    // data-icon ids are exactly dsw-icon-<ICON_ARTWORK key>-<weight>
    for (const w of ["regular", "medium"]) {
      bySymbol[`dsw-icon-${glyph}-${w}`] = markup;
    }
  }

  for (const [role, cool] of Object.entries(ROLE_MAP)) {
    const raw = readCool(cool, "duo");
    if (!raw) {
      missing.push(`role:${role}->${cool}`);
      continue;
    }
    byRole[role] = normalizeInline(raw);
  }

  // Also fill solid variants for any leftover masks
  const fillFiles = {};
  for (const cool of new Set([...Object.values(GLYPH_MAP), ...Object.values(ROLE_MAP)])) {
    const raw = readCool(cool, "fill") || readCool(cool, "duo");
    if (raw) fillFiles[cool] = prepareMask(raw);
  }

  return { byGlyph, byRole, bySymbol, fillFiles, missing };
}

function prepareMask(svg) {
  let s = String(svg);
  s = s.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/viewBox=/.test(s)) s = s.replace("<svg", '<svg viewBox="0 0 24 24"');
  return s;
}

const SCRIPT_ID = "beam-coolicons-force";

function makeScript(payload) {
  const json = JSON.stringify({
    byRole: payload.byRole,
    bySymbol: payload.bySymbol,
  });
  return `<script id="${SCRIPT_ID}">
(() => {
  if (window.__beamCooliconsForceV3) return;
  window.__beamCooliconsForceV3 = true;
  const DATA = ${json};
  const SVG_NS = "http://www.w3.org/2000/svg";

  const parseSvg = (markup) => {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() === "parsererror") return null;
    return root;
  };

  const fillHost = (hostSvg, markup) => {
    if (!hostSvg || !markup) return false;
    const root = parseSvg(markup);
    if (!root) return false;
    const w = hostSvg.getAttribute("width");
    const h = hostSvg.getAttribute("height");
    const cls = hostSvg.getAttribute("class");
    const dataIcon = hostSvg.getAttribute("data-icon");
    while (hostSvg.firstChild) hostSvg.removeChild(hostSvg.firstChild);
    // copy presentation
    for (const { name, value } of [...root.attributes]) {
      if (name === "width" || name === "height" || name === "class" || name === "style") continue;
      hostSvg.setAttribute(name, value);
    }
    if (!hostSvg.getAttribute("viewBox")) hostSvg.setAttribute("viewBox", root.getAttribute("viewBox") || "0 0 24 24");
    if (w) hostSvg.setAttribute("width", w);
    if (h) hostSvg.setAttribute("height", h);
    if (cls) hostSvg.setAttribute("class", cls);
    if (dataIcon) hostSvg.setAttribute("data-icon", dataIcon);
    hostSvg.setAttribute("data-beam-cool", "1");
    hostSvg.style.color = "inherit";
    for (const node of [...root.childNodes]) hostSvg.appendChild(document.importNode(node, true));
    // kill <use> leftovers
    for (const u of hostSvg.querySelectorAll("use")) u.remove();
    return true;
  };

  const replaceIn = (root) => {
    if (!root || !root.querySelectorAll) return 0;
    let n = 0;
    for (const svg of root.querySelectorAll('svg[data-icon^="dsw-icon-"]')) {
      if (svg.getAttribute("data-beam-cool") === "1" && svg.querySelector("path,circle,rect,g")) continue;
      const id = svg.getAttribute("data-icon");
      let markup = DATA.bySymbol[id];
      if (!markup) {
        // fuzzy: strip weight
        const key = Object.keys(DATA.bySymbol).find((k) => id && id.startsWith(k.replace(/-(regular|medium)$/, "")) || (id && k.startsWith(id.split("-regular")[0].split("-medium")[0])));
        // simpler fuzzy
        const base = String(id || "").replace(/^dsw-icon-/, "").replace(/-(regular|medium)$/, "").replace(/-outline$/, "").replace(/-fill$/, "");
        for (const [k, v] of Object.entries(DATA.bySymbol)) {
          if (k.includes(base)) { markup = v; break; }
        }
      }
      if (markup && fillHost(svg, markup)) n++;
    }
    // Role-tagged chrome: replace first svg child
    for (const el of root.querySelectorAll("[data-beam-icon]")) {
      const role = el.getAttribute("data-beam-icon");
      const markup = DATA.byRole[role];
      if (!markup) continue;
      const svg = el.querySelector("svg");
      if (svg && fillHost(svg, markup)) n++;
    }
    // Hard chrome without tags
    const hard = [
      ['.wtg9ga_newSession svg, button[class*="newSession"] svg', "plus"],
      ['[class*="panelIcon"] svg, [class*="panelGlyph"] svg', null],
    ];
    for (const svg of root.querySelectorAll('.wtg9ga_newSession svg, button[class*="newSession"] svg')) {
      if (DATA.byRole.plus && fillHost(svg, DATA.byRole.plus)) n++;
    }
    return n;
  };

  const patchSprite = () => {
    const sprite = document.querySelector("svg[data-dsh-icon-sprite], svg[data-beam-icon-sprite]");
    if (!sprite) return;
    for (const [id, markup] of Object.entries(DATA.bySymbol)) {
      const root = parseSvg(markup);
      if (!root) continue;
      let sym = sprite.querySelector("#" + CSS.escape(id));
      if (!sym) {
        sym = document.createElementNS(SVG_NS, "symbol");
        sym.id = id;
        sprite.appendChild(sym);
      }
      while (sym.firstChild) sym.removeChild(sym.firstChild);
      for (const { name, value } of [...root.attributes]) {
        if (name === "width" || name === "height" || name === "xmlns" || name === "class" || name === "style") continue;
        sym.setAttribute(name, value);
      }
      if (!sym.getAttribute("viewBox")) sym.setAttribute("viewBox", "0 0 24 24");
      for (const node of [...root.childNodes]) sym.appendChild(document.importNode(node, true));
    }
    sprite.setAttribute("data-beam-coolicons-force", "1");
  };

  let scheduled = false;
  const run = () => {
    scheduled = false;
    try {
      patchSprite();
      replaceIn(document);
    } catch (e) {
      console.warn("[beam-coolicons]", e);
    }
  };
  const kick = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };

  const boot = () => {
    run();
    new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(run, 1500);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>`;
}

function killMaskCss(css) {
  const markStart = "/* ===== BEAM custom icons";
  const markAlt = "/* BEAM coolicons masks */";
  let s = css;

  // Neutralize every mask rule that zeros SVG children / applies beam-icons masks
  s = s.replace(
    /-webkit-mask:\s*url\("\.\/beam-icons\/[^"]+"\)[^;]*!important;/g,
    "/* coolicons: mask disabled */"
  );
  s = s.replace(
    /(?<!-webkit-)mask:\s*url\("\.\/beam-icons\/[^"]+"\)[^;]*!important;/g,
    "/* coolicons: mask disabled */"
  );
  // Stop hiding original paths — we replace them with coolicons inline
  s = s.replace(
    /\[data-beam-icon[^\]]*\][^{]*\{[^}]*opacity:\s*0\s*!important;[^}]*\}/g,
    "/* coolicons: opacity-kill removed */"
  );
  // Broader: any rule that sets svg * opacity 0 for beam icons
  s = s.replace(
    /(\[data-beam-icon[^\]]*\][^\n{]*svg \*[^\n{]*\{[^}]*)opacity:\s*0\s*!important;/g,
    "$1/* opacity restored */"
  );
  s = s.replace(
    /(button\[class\*=\"newSession\"\][^\n{]*svg \*[^\n{]*\{[^}]*)opacity:\s*0\s*!important;/g,
    "$1/* opacity restored */"
  );
  s = s.replace(
    /(\.wtg9ga_newSession[^\n{]*svg \*[^\n{]*\{[^}]*)opacity:\s*0\s*!important;/g,
    "$1/* opacity restored */"
  );
  s = s.replace(
    /background-color:\s*currentColor\s*!important;/g,
    "/* coolicons: no mask bg */"
  );

  if (!s.includes("BEAM coolicons FORCE")) {
    s += `

/* ===== BEAM coolicons FORCE ===== */
svg[data-beam-cool="1"],
svg[data-icon^="dsw-icon-"] {
  color: inherit !important;
  background: none !important;
  -webkit-mask: none !important;
  mask: none !important;
  opacity: 1 !important;
  fill: none !important;
}
svg[data-beam-cool="1"] *,
svg[data-icon^="dsw-icon-"][data-beam-cool="1"] * {
  opacity: 1 !important;
}
svg[data-beam-cool="1"] [stroke-opacity],
svg[data-beam-cool="1"] path[stroke-opacity] {
  /* duocolor secondary path */
}
`;
  }
  return s;
}

function writeAssets(assetsDir, payload) {
  const bold = path.join(assetsDir, "beam-icons", "bold");
  const fill = path.join(assetsDir, "beam-icons", "fill");
  fs.mkdirSync(bold, { recursive: true });
  fs.mkdirSync(fill, { recursive: true });
  // Wipe old flaticon leftovers by rewriting every known cool name + aliases
  for (const [cool, svg] of Object.entries(payload.fillFiles)) {
    fs.writeFileSync(path.join(bold, `${cool}.svg`), svg);
    fs.writeFileSync(path.join(fill, `${cool}.svg`), svg);
  }
  // Role filename aliases used by old CSS
  for (const [role, cool] of Object.entries(ROLE_MAP)) {
    const src = path.join(bold, `${cool}.svg`);
    if (!fs.existsSync(src)) continue;
    // also write under role name
    fs.copyFileSync(src, path.join(bold, `${role}.svg`));
    fs.copyFileSync(src, path.join(fill, `${role}.svg`));
  }
  fs.writeFileSync(
    path.join(assetsDir, "beam-icons", "map.json"),
    JSON.stringify({ map: ROLE_MAP, source: "coolicons-force", missing: payload.missing }, null, 2)
  );
}

function patchTree(webDist, payload, script) {
  const assets = path.join(webDist, "assets");
  const cssPath = path.join(assets, "beam-override.css");
  const htmlPath = path.join(webDist, "index.html");
  if (!fs.existsSync(htmlPath)) return false;

  writeAssets(assets, payload);

  if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, "utf8");
    css = killMaskCss(css);
    fs.writeFileSync(cssPath, css);
  }

  let html = fs.readFileSync(htmlPath, "utf8");
  // Remove older coolicons scripts to avoid fights
  html = html.replace(/<script id="beam-coolicons-sprite">[\s\S]*?<\/script>\s*/g, "");
  html = html.replace(/<script id="beam-coolicons-force">[\s\S]*?<\/script>\s*/g, "");
  if (html.includes("</body>")) html = html.replace("</body>", script + "\n</body>");
  else html += "\n" + script + "\n";
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=coolforce3"'
  );
  fs.writeFileSync(htmlPath, html);
  return true;
}

const payload = buildPayload();
console.log("symbols", Object.keys(payload.bySymbol).length, "roles", Object.keys(payload.byRole).length, "missing", payload.missing);

const script = makeScript(payload);
const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

let n = 0;
for (const web of WEBS) {
  const ok = patchTree(web, payload, script);
  console.log(path.relative(ROOT, web), ok);
  if (ok) n++;
}
fs.writeFileSync(
  path.join(ROOT, "desktop/_coolicons-force-report.json"),
  JSON.stringify({ missing: payload.missing, roles: Object.keys(payload.byRole).length, symbols: Object.keys(payload.bySymbol).length }, null, 2)
);
console.log("FORCE coolicons ok", n);
