/**
 * 1) Revert GLYPH_MAP to short keys matching live sprite ids (dsw-icon-settings-regular)
 * 2) Nuke leftover opacity:0 on svg * (mask leftovers)
 * 3) Patch sprite symbols in index.html directly with coolicons
 * 4) Re-inject force script V4 with stronger CSS
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORCE = path.join(ROOT, "desktop/patch-coolicons-force.mjs");
const VENDOR = path.join(ROOT, "desktop/vendor/coolicons/icons/svg");
const DUO = path.join(VENDOR, "duocolor/round");
const FILL = path.join(VENDOR, "fill/round");
const LINE = path.join(VENDOR, "line/round");

const LIVE_WEBS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

// Short keys = sprite ids without -outline/-fill
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

function readCool(name) {
  for (const dir of [DUO, LINE, FILL]) {
    const p = path.join(dir, `${name}.svg`);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return null;
}

function innerMarkup(svg) {
  let s = String(svg).trim();
  const m = s.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!m) return "";
  let inner = m[1].trim();
  // force currentColor inheritance
  inner = inner.replace(/\sstroke="(?!currentColor)[^"]*"/g, ' stroke="currentColor"');
  inner = inner.replace(/\sfill="(?!none|currentColor)[^"]*"/g, ' fill="currentColor"');
  return inner;
}

function viewBox(svg) {
  const m = String(svg).match(/viewBox="([^"]+)"/);
  return m ? m[1] : "0 0 24 24";
}

function buildBySymbol() {
  const bySymbol = {};
  const missing = [];
  for (const [glyph, cool] of Object.entries(GLYPH_MAP)) {
    const raw = readCool(cool);
    if (!raw) {
      missing.push(`${glyph}->${cool}`);
      continue;
    }
    const vb = viewBox(raw);
    const inner = innerMarkup(raw);
    const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none" width="100%" height="100%" style="display:block;width:1em;height:1em">${inner}</svg>`;
    for (const w of ["regular", "medium"]) {
      bySymbol[`dsw-icon-${glyph}-${w}`] = { full, inner, vb };
    }
  }
  return { bySymbol, missing };
}

function nukeCss(css) {
  let s = css;
  // Kill every "svg * { ... opacity: 0 ... }" style leftover from masks
  s = s.replace(
    /([^{}]*svg\s*\*[^{]*)\{\s*opacity:\s*0\s*!important;?\s*\}/gi,
    "$1{ /* coolicons: svg* opacity KILLED */ }"
  );
  // Also kill fill/stroke transparent killers on icon svg children (not fish)
  s = s.replace(
    /(button\[aria-label[^{]*svg\s*\*[^{]*)\{[^}]*\}/gi,
    "$1{ /* coolicons: aria svg* killed */ }"
  );
  s = s.replace(
    /(\[class\*="(?:sendButton|SendButton|attach)"\][^{]*svg\s*\*[^{]*)\{[^}]*\}/gi,
    "$1{ /* coolicons: class svg* killed */ }"
  );

  // Strip remaining mask urls
  s = s.replace(/-webkit-mask:\s*url\("\.\/beam-icons\/[^"]+"\)[^;]*;?/g, "/* mask off */");
  s = s.replace(/(?<!-webkit-)mask:\s*url\("\.\/beam-icons\/[^"]+"\)[^;]*;?/g, "/* mask off */");

  const FORCE_BLOCK = `

/* ===== BEAM coolicons FORCE V4 ===== */
svg[data-icon^="dsw-icon-"],
svg[data-beam-cool="1"],
[data-beam-icon] > svg,
[data-beam-icon] svg {
  color: inherit !important;
  background: none !important;
  -webkit-mask: none !important;
  mask: none !important;
  opacity: 1 !important;
}
svg[data-icon^="dsw-icon-"] *,
svg[data-beam-cool="1"] *,
[data-beam-icon] svg *,
button[aria-label] svg *,
[class*="sendButton"] svg *,
[class*="SendButton"] svg *,
[class*="attach"] svg *,
[class*="iconButton"] svg *,
[class*="panelGlyph"] svg *,
.wtg9ga_newSession svg *,
button[class*="newSession"] svg * {
  opacity: 1 !important;
  visibility: visible !important;
}
svg[data-beam-cool="1"] path[stroke],
svg[data-icon^="dsw-icon-"] path[stroke] {
  stroke: currentColor !important;
}
`;

  // replace old FORCE block if present
  s = s.replace(/\/\* ===== BEAM coolicons FORCE[\s\S]*?(?=\/\* =====|$)/, "");
  if (!s.includes("BEAM coolicons FORCE V4")) s += FORCE_BLOCK;
  return s;
}

function patchSpriteInHtml(html, bySymbol) {
  let n = 0;
  // Replace <symbol id="dsw-icon-...">...</symbol> contents
  html = html.replace(
    /<symbol\b([^>]*\bid="(dsw-icon-[^"]+)"[^>]*)>([\s\S]*?)<\/symbol>/gi,
    (all, attrs, id) => {
      const hit = bySymbol[id];
      if (!hit) return all;
      n++;
      let a = attrs;
      if (/viewBox=/.test(a)) a = a.replace(/viewBox="[^"]*"/, `viewBox="${hit.vb}"`);
      else a += ` viewBox="${hit.vb}"`;
      return `<symbol${a}>${hit.inner}</symbol>`;
    }
  );
  // Also handle self-closing / different order of attrs already covered
  return { html, n };
}

function makeScript(bySymbol) {
  const data = {};
  for (const [id, v] of Object.entries(bySymbol)) data[id] = v.full;
  const json = JSON.stringify({ bySymbol: data });
  return `<script id="beam-coolicons-force">
(() => {
  if (window.__beamCooliconsForceV4) return;
  window.__beamCooliconsForceV4 = true;
  const DATA = ${json};
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
    hostSvg.style.opacity = "1";
    for (const node of [...root.childNodes]) hostSvg.appendChild(document.importNode(node, true));
    for (const u of hostSvg.querySelectorAll("use")) u.remove();
    return true;
  };
  const replaceIn = (root) => {
    if (!root || !root.querySelectorAll) return;
    for (const svg of root.querySelectorAll('svg[data-icon^="dsw-icon-"]')) {
      if (svg.getAttribute("data-beam-cool") === "1" && svg.querySelector("path,circle,rect,g")) continue;
      const id = svg.getAttribute("data-icon");
      let markup = DATA.bySymbol[id];
      if (!markup) {
        const base = String(id || "").replace(/-(regular|medium)$/, "");
        for (const [k, v] of Object.entries(DATA.bySymbol)) {
          if (k.startsWith(base + "-") || k === base) { markup = v; break; }
        }
      }
      if (markup) fillHost(svg, markup);
    }
    // Any svg that only has <use href="#dsw-icon-...">
    for (const use of root.querySelectorAll("svg use")) {
      const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
      const id = href.replace(/^#/, "");
      if (!id.startsWith("dsw-icon-")) continue;
      const svg = use.ownerSVGElement || use.closest("svg");
      const markup = DATA.bySymbol[id];
      if (svg && markup) fillHost(svg, markup);
    }
  };
  const patchSprite = () => {
    const sprite = document.querySelector("svg[data-dsh-icon-sprite], svg[data-beam-icon-sprite], svg#__dsw_icon_sprite, body > svg");
    const sprites = [
      ...document.querySelectorAll("svg[data-dsh-icon-sprite], svg[data-beam-icon-sprite]"),
    ];
    // also first hidden sprite with many symbols
    for (const s of document.querySelectorAll("svg")) {
      if (s.querySelectorAll("symbol[id^='dsw-icon-']").length > 10) sprites.push(s);
    }
    for (const sprite of sprites) {
      for (const [id, markup] of Object.entries(DATA.bySymbol)) {
        const root = parseSvg(markup);
        if (!root) continue;
        let sym = sprite.querySelector("#" + CSS.escape(id));
        if (!sym) continue;
        while (sym.firstChild) sym.removeChild(sym.firstChild);
        if (!sym.getAttribute("viewBox")) sym.setAttribute("viewBox", root.getAttribute("viewBox") || "0 0 24 24");
        else sym.setAttribute("viewBox", root.getAttribute("viewBox") || "0 0 24 24");
        for (const node of [...root.childNodes]) sym.appendChild(document.importNode(node, true));
      }
      sprite.setAttribute("data-beam-coolicons-force", "4");
    }
  };
  let scheduled = false;
  const run = () => {
    scheduled = false;
    try { patchSprite(); replaceIn(document); } catch (e) { console.warn("[beam-coolicons]", e); }
  };
  const kick = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(run); };
  const boot = () => {
    run();
    new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(run, 1200);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>`;
}

// Sync short GLYPH_MAP into force file for future runs
{
  let forceSrc = fs.readFileSync(FORCE, "utf8");
  const start = forceSrc.indexOf("const GLYPH_MAP = {");
  const end = forceSrc.indexOf("const ROLE_MAP = {");
  if (start >= 0 && end > start) {
    const body = Object.entries(GLYPH_MAP)
      .map(([k, v]) => ( /^[a-z][a-z0-9]*$/.test(k) ? `  ${k}: ${JSON.stringify(v)},` : `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`))
      .join("\n");
    forceSrc = forceSrc.slice(0, start) + `const GLYPH_MAP = {\n${body}\n};\n\n` + forceSrc.slice(end);
    fs.writeFileSync(FORCE, forceSrc);
    console.log("synced short GLYPH_MAP into force patch");
  }
}

const { bySymbol, missing } = buildBySymbol();
console.log("symbols", Object.keys(bySymbol).length, "missing", missing);

const script = makeScript(bySymbol);
let patched = 0;

for (const web of LIVE_WEBS) {
  const htmlPath = path.join(web, "index.html");
  const cssPath = path.join(web, "assets", "beam-override.css");
  if (!fs.existsSync(htmlPath)) {
    console.log("skip", path.relative(ROOT, web));
    continue;
  }

  if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, "utf8");
    css = nukeCss(css);
    fs.writeFileSync(cssPath, css);
  }

  let html = fs.readFileSync(htmlPath, "utf8");
  const spr = patchSpriteInHtml(html, bySymbol);
  html = spr.html;
  html = html.replace(/<script id="beam-coolicons-force">[\s\S]*?<\/script>\s*/g, "");
  html = html.replace(/<script id="beam-coolicons-sprite">[\s\S]*?<\/script>\s*/g, "");
  if (html.includes("</body>")) html = html.replace("</body>", script + "\n</body>");
  else html += "\n" + script + "\n";
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=coolforce4"'
  );
  fs.writeFileSync(htmlPath, html);
  patched++;
  console.log("patched", path.relative(ROOT, web), "symbols-replaced", spr.n);
}

// Also dump fill assets so any leftover mask still looks like coolicons
for (const web of LIVE_WEBS) {
  const bold = path.join(web, "assets/beam-icons/bold");
  const fill = path.join(web, "assets/beam-icons/fill");
  if (!fs.existsSync(path.join(web, "index.html"))) continue;
  fs.mkdirSync(bold, { recursive: true });
  fs.mkdirSync(fill, { recursive: true });
  for (const cool of new Set(Object.values(GLYPH_MAP))) {
    const raw = readCool(cool);
    if (!raw) continue;
    // Prefer fill for masks
    const fillRaw = (() => {
      const p = path.join(FILL, `${cool}.svg`);
      return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : raw;
    })();
    let s = fillRaw.replace(/\s(width|height)="[^"]*"/g, "");
    fs.writeFileSync(path.join(bold, `${cool}.svg`), s);
    fs.writeFileSync(path.join(fill, `${cool}.svg`), s);
  }
}

fs.writeFileSync(
  path.join(ROOT, "desktop/_coolicons-force-report.json"),
  JSON.stringify({ missing, symbols: Object.keys(bySymbol).length, patched }, null, 2)
);
console.log("DONE patched", patched, "missing", missing);
