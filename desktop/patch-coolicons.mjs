/**
 * Replace all product icon sprite symbols with coolicons (duocolor/round,
 * duotone/round only where fill-heavy). Colors inherit currentColor / Beam UI.
 *
 * Source: https://github.com/krystonschwarze/coolicons
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = path.join(ROOT, "desktop/vendor/coolicons/icons/svg");
const DUOCOLOR = path.join(VENDOR, "duocolor/round");
const DUOTONE = path.join(VENDOR, "duotone/round");

/** DSH glyph → coolicon file basename (no .svg). Prefer duocolor; mark :duotone for fill-heavy. */
const MAP = {
  "agent-preset-outline": "agent",
  "alarm-clock-outline": "alarm",
  "api-outline": "api",
  "apps-add-compact-outline": "grid",
  "apps-add-outline": "grid",
  "archive-check-outline": "archive",
  "archive-off-outline": "archive",
  "archive-outline": "archive",
  "branch-outline": "git-branch",
  "browse-outline": "globe",
  "check-circle-fill": "circle-check:duotone",
  "check-circle-outline": "circle-check",
  "checklist-outline": "list-check",
  "check-outline": "check",
  "chevron-down-outline": "chevron-down",
  "chevron-left-outline": "chevron-left",
  "chevron-right-outline": "chevron-right",
  "chevrons-up-down-outline": "chevron-double-down",
  "chevron-up-outline": "chevron-up",
  "clock-outline": "clock",
  "close-circle-fill": "circle-close:duotone",
  "close-fill": "close",
  "close-outline": "close",
  "code-outline": "code",
  "compact-outline": "shrink",
  "compare-split-outline": "columns",
  "context-injection-outline": "file-download",
  "copy-outline": "copy",
  "cordis-plugin-outline": "puzzle",
  "dark-outline": "moon",
  "database-outline": "database",
  "data-outline": "chart-bar-vertical",
  "deliver-doc": "file-text",
  "dislike-fill": "thumbs-down:duotone",
  "dislike-outline": "thumbs-down",
  "download-outline": "download",
  "drag-handle-outline": "menu-alt-2",
  "edit-outline": "pencil",
  "ellipsis-outline": "more-horizontal",
  "enhance-outline": "text-align-left",
  "eye-off-outline": "eye-off",
  "eye-outline": "eye",
  "flat-list-outline": "list-unordered",
  "folder-close": "folder",
  "folder-open": "folder-open",
  "folder-open-outline": "folder-open",
  "followsystem-outline": "monitor",
  "fullscreen-outline": "expand",
  "gauge-outline": "gauge",
  "globe-outline": "globe",
  "goal-outline": "target",
  "info-outline": "circle-info",
  "inspect-outline": "brackets",
  "layers-outline": "layers",
  "light-outline": "sun",
  "like-fill": "thumbs-up:duotone",
  "like-outline": "thumbs-up",
  "link-outline": "link",
  "list-pen-outline": "note-edit",
  "loading-outline": "loading",
  "mail-read-outline": "mail-open",
  "mail-unread-outline": "mail",
  "microphone-outline": "microphone",
  "new-chat-outline": "chat-plus",
  "nowrap-fill": "text-wrap",
  "panel-left-outline": "panel-left",
  "paperclip-outline": "paperclip",
  "paper-plane-outline": "paper-plane",
  "pause-outline": "circle-pause",
  "personalization-outline": "slider-2",
  "pin-fill": "pin:duotone",
  "pin-outline": "pin",
  "plan-outline": "map",
  "play-outline": "circle-play",
  "plugin-pinwheel-outline": "puzzle",
  "plus-outline": "plus",
  "project-add-outline": "folder-plus",
  "question-outline": "circle-help",
  "queue-outline": "list-unordered",
  "refresh-outline": "reload",
  "right-up-outline": "arrow-up-right",
  "save-outline": "save",
  "search-outline": "search",
  "send-outline": "arrow-up",
  "settings-outline": "settings",
  "share-outline": "share",
  "shield-outline": "shield",
  "skill-outline": "sparkle",
  "sliders-two-outline": "slider-2",
  sparkle: "sparkle",
  "stop-fill": "stop:duotone",
  "think-outline": "brain",
  "trash-outline": "trash",
  "tree-corner": "arrow-down-right",
  "triangle-right-fill": "play:duotone",
  "unarchive-outline": "archive-restore",
  "upload-outline": "upload",
  "user-outline": "user",
  "users-outline": "users",
  "warning-outline": "circle-warning",
  "warning-triangle-outline": "triangle-warning",
  "workspace-tree-outline": "list-tree",
  "wrap-fill": "text-wrap:duotone",
  "wrap-lines-outline": "text-wrap",
};

function resolveIconFile(spec) {
  const duotone = spec.endsWith(":duotone");
  const name = duotone ? spec.slice(0, -":duotone".length) : spec;
  const primary = path.join(duotone ? DUOTONE : DUOCOLOR, `${name}.svg`);
  if (fs.existsSync(primary)) return primary;
  const alt = path.join(duotone ? DUOCOLOR : DUOTONE, `${name}.svg`);
  if (fs.existsSync(alt)) return alt;
  // fuzzy fallbacks
  for (const dir of [DUOCOLOR, DUOTONE]) {
    for (const cand of [`${name}.svg`, `${name}-alt.svg`, `${name}-circle.svg`]) {
      const p = path.join(dir, cand);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function normalizeSvg(raw) {
  let s = String(raw).trim();
  // Ensure viewBox; drop fixed size so <use> site controls size
  s = s.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/viewBox=/.test(s)) {
    s = s.replace("<svg", '<svg viewBox="0 0 24 24"');
  }
  // Prefer Beam-visible duocolor: keep currentColor + opacity on secondary
  // Boost secondary opacity slightly for dark UI readability
  s = s.replace(/stroke-opacity="0\.4"/g, 'stroke-opacity="0.45"');
  s = s.replace(/fill-opacity="0\.4"/g, 'fill-opacity="0.45"');
  s = s.replace(/fill-opacity="0\.2"/g, 'fill-opacity="0.35"');
  return s;
}

function buildSymbols() {
  const symbols = {};
  const missing = [];
  for (const [glyph, spec] of Object.entries(MAP)) {
    const file = resolveIconFile(spec);
    if (!file) {
      missing.push(`${glyph} → ${spec}`);
      continue;
    }
    const markup = normalizeSvg(fs.readFileSync(file, "utf8"));
    for (const weight of ["regular", "medium"]) {
      symbols[`dsw-icon-${glyph}-${weight}`] = markup;
    }
  }
  return { symbols, missing };
}

const { symbols, missing } = buildSymbols();
if (missing.length) {
  console.warn("missing coolicon mappings:", missing.slice(0, 30).join(", "), missing.length > 30 ? `…+${missing.length - 30}` : "");
}
console.log("mapped symbols", Object.keys(symbols).length);

const SCRIPT_ID = "beam-coolicons-sprite";
const payload = JSON.stringify(symbols);

const SCRIPT = `<script id="${SCRIPT_ID}">
(() => {
  if (window.__beamCooliconsV1) return;
  window.__beamCooliconsV1 = true;
  const MAP = ${payload};
  const SVG_NS = "http://www.w3.org/2000/svg";

  const toSymbol = (id, markup) => {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() === "parsererror") return null;
    const symbol = document.createElementNS(SVG_NS, "symbol");
    for (const { name, value } of [...root.attributes]) {
      if (name === "width" || name === "height" || name === "xmlns" || name === "class" || name === "aria-hidden") continue;
      symbol.setAttribute(name, value);
    }
    symbol.id = id;
    for (const node of [...root.childNodes]) symbol.appendChild(document.importNode(node, true));
    return symbol;
  };

  const apply = (sprite) => {
    if (!sprite) return;
    let n = 0;
    for (const [id, markup] of Object.entries(MAP)) {
      const next = toSymbol(id, markup);
      if (!next) continue;
      const prev = sprite.querySelector("#" + CSS.escape(id));
      if (prev) prev.replaceWith(next);
      else sprite.appendChild(next);
      n++;
    }
    sprite.setAttribute("data-beam-coolicons", String(n));
  };

  const tick = () => {
    const sprite = document.querySelector("svg[data-dsh-icon-sprite], svg[data-beam-icon-sprite]");
    if (sprite) apply(sprite);
  };

  const boot = () => {
    tick();
    const mo = new MutationObserver(() => tick());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    // Re-apply on theme changes that rebuild symbols
    setInterval(tick, 2500);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>`;

const CSS_SNIP = `/* beam-coolicons: inherit Beam label colors; secondary path via opacity */
svg[data-icon^="dsw-icon-"] {
  color: inherit;
}
`;

function upsertHtml(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  const re = new RegExp(`<script id="${SCRIPT_ID}">[\\s\\S]*?<\\/script>\\s*`, "m");
  if (re.test(html)) html = html.replace(re, SCRIPT + "\n");
  else if (html.includes("</body>")) html = html.replace("</body>", SCRIPT + "\n</body>");
  else html += "\n" + SCRIPT + "\n";
  // light CSS hook in override if linked
  fs.writeFileSync(file, html);
  return true;
}

function upsertCss(file) {
  if (!fs.existsSync(file)) return false;
  let css = fs.readFileSync(file, "utf8");
  const mark = "/* ===== BEAM coolicons ===== */";
  const block = `${mark}\n${CSS_SNIP}`;
  if (css.includes(mark)) {
    const start = css.indexOf(mark);
    const next = css.indexOf("\n/* =====", start + mark.length);
    css = css.slice(0, start) + block + (next > start ? css.slice(next) : "");
  } else {
    css = css.trimEnd() + "\n\n" + block + "\n";
  }
  // cache bust hint via hist-style already on link; bump coolicons query if present
  fs.writeFileSync(file, css);
  return true;
}

const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

let n = 0;
for (const web of WEBS) {
  const h = upsertHtml(path.join(web, "index.html"));
  const c = upsertCss(path.join(web, "assets/beam-override.css"));
  // also bump css query for cache
  const index = path.join(web, "index.html");
  if (fs.existsSync(index)) {
    let html = fs.readFileSync(index, "utf8");
    html = html.replace(
      /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
      'href="./assets/beam-override.css?v=cool1"'
    );
    fs.writeFileSync(index, html);
  }
  console.log(path.relative(ROOT, web), { html: h, css: c });
  if (h || c) n++;
}

// Persist mapping report
fs.writeFileSync(
  path.join(ROOT, "desktop/_coolicons-map-report.json"),
  JSON.stringify({ count: Object.keys(symbols).length, missing, map: MAP }, null, 2)
);
console.log("coolicons patch ok", n);
