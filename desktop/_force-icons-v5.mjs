/**
 * Coolicons V5 — actually visible:
 * App uses inline SVG (NOT dsw-icon sprite). Replace by data-beam-icon + aria-label.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = path.join(ROOT, "desktop/vendor/coolicons/icons/svg");
const DUO = path.join(VENDOR, "duocolor/round");
const FILL = path.join(VENDOR, "fill/round");
const LINE = path.join(VENDOR, "line/round");

const WEBS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

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
  "chat-plus": "chat-plus",
  archive: "archive",
  pin: "pin",
  collapse: "panel-left",
  expand: "panel-right",
  options: "more-horizontal",
  "add-project": "folder-plus",
  fullscreen: "expand",
  split: "columns",
  "new-tab": "plus",
  limits: "gauge",
  model: "sparkle",
  "open-right": "panel-right",
};

const LABEL_RULES = [
  [/плагин|plugin/i, "plugins"],
  [/автоматиз|automation|schedule|задач/i, "automation"],
  [/ещё|more|apps add|больше/i, "more"],
  [/новая сессия|new session|new chat|новый чат/i, "plus"],
  [/рабоч|workspace|folder|область/i, "workspace"],
  [/поиск|search/i, "search"],
  [/настрой|settings/i, "settings"],
  [/отправ|send/i, "send"],
  [/прикреп|attach|clip|файл|file/i, "attach"],
  [/обнов|refresh|update/i, "refresh"],
  [/выйти|logout|sign out/i, "logout"],
  [/войти|login|sign in/i, "login"],
  [/копир|copy/i, "copy"],
  [/подел|share/i, "share"],
  [/нравится|thumbs up/i, "thumbs-up"],
  [/не нравится|thumbs down/i, "thumbs-down"],
  [/уведом|bell|notification/i, "bell"],
  [/удал|trash|delete/i, "trash"],
  [/редактир|edit|rename/i, "edit"],
  [/микрофон|microphone|voice/i, "microphone"],
  [/архив|archive/i, "archive"],
  [/закреп|pin session|unpin|откреп/i, "pin"],
  [/свернуть боков|collapse sidebar/i, "collapse"],
  [/развернуть боков|expand sidebar/i, "expand"],
  [/параметр|view options/i, "options"],
  [/добавить проект|add project/i, "add-project"],
  [/полноэкран|fullscreen/i, "fullscreen"],
  [/раздел|split/i, "split"],
  [/новая вклад|new tab/i, "new-tab"],
  [/лимит|limits/i, "limits"],
  [/модель|model,/i, "model"],
  [/правую боков|right sidebar|open right|collapse right/i, "open-right"],
];

function readCool(name) {
  // Prefer FILL so icons visibly differ from old DSH stroke glyphs
  for (const dir of [FILL, DUO, LINE]) {
    const p = path.join(dir, `${name}.svg`);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  return null;
}

function normalizeInline(svg) {
  let s = String(svg).trim();
  s = s.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/viewBox=/.test(s)) s = s.replace("<svg", '<svg viewBox="0 0 24 24"');
  s = s.replace(
    /<svg\b/,
    '<svg width="100%" height="100%" style="display:block;width:1em;height:1em;overflow:visible"'
  );
  // ensure stroke uses currentColor
  s = s.replace(/\sstroke="(?!currentColor|none)[^"]*"/g, ' stroke="currentColor"');
  return s;
}

function buildByRole() {
  const byRole = {};
  const missing = [];
  for (const [role, cool] of Object.entries(ROLE_MAP)) {
    const raw = readCool(cool);
    if (!raw) {
      missing.push(`${role}->${cool}`);
      continue;
    }
    byRole[role] = normalizeInline(raw);
  }
  return { byRole, missing };
}

function nukeCss(css) {
  let s = css;
  // Kill svg* opacity 0 leftovers from mask era
  s = s.replace(
    /([^{}/\n]*svg\s*\*[^{]*)\{\s*opacity:\s*0\s*!important;?\s*\}/gi,
    "$1{ /* coolicons V5: opacity restored */ }"
  );
  s = s.replace(
    /(button\[aria-label[^{]*svg\s*\*[^{]*)\{[^}]*\}/gi,
    "$1{ /* coolicons V5: aria svg* open */ }"
  );
  // Kill mask urls
  s = s.replace(/-webkit-mask:\s*url\("\.\/beam-icons\/[^"]+"\)[^;]*;?/g, "/* mask off */");
  s = s.replace(/(?<!-webkit-)mask:\s*url\("\.\/beam-icons\/[^"]+"\)[^;]*;?/g, "/* mask off */");
  s = s.replace(/background-color:\s*currentColor\s*!important;/g, "/* no mask bg */");

  // Remove prior FORCE blocks
  s = s.replace(/\/\* ===== BEAM coolicons FORCE[\s\S]*?(?=\/\* =====|$)/g, "");

  s += `

/* ===== BEAM coolicons FORCE V7 ===== */
svg[data-beam-cool="1"],
[data-beam-icon] > svg,
[data-beam-icon] svg,
button[aria-label] svg,
[class*="panelGlyph"] svg,
[class*="iconButton"] svg,
.wtg9ga_newSession svg,
button[class*="newSession"] svg {
  color: inherit !important;
  background: none !important;
  -webkit-mask: none !important;
  mask: none !important;
  opacity: 1 !important;
  overflow: visible !important;
}
svg[data-beam-cool="1"] *,
[data-beam-icon] svg *,
button[aria-label] svg *,
[class*="panelGlyph"] svg *,
[class*="iconButton"] svg *,
[class*="sendButton"] svg *,
[class*="SendButton"] svg *,
[class*="attach"] svg *,
.wtg9ga_newSession svg *,
button[class*="newSession"] svg * {
  opacity: 1 !important;
  visibility: visible !important;
}
svg[data-beam-cool="1"] path[stroke] {
  stroke: currentColor !important;
}
`;
  return s;
}

function makeScript(byRole) {
  const json = JSON.stringify({ byRole, rules: LABEL_RULES.map(([re, role]) => [String(re), role]) });
  return `<script id="beam-coolicons-force">
(() => {
  if (window.__beamCooliconsForceV7) return;
  window.__beamCooliconsForceV7 = true;
  const DATA = ${json};
  const RULES = DATA.rules.map(([src, role]) => [new RegExp(src.slice(1, src.lastIndexOf("/")), src.slice(src.lastIndexOf("/") + 1)), role]);

  const parseSvg = (markup) => {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() === "parsererror") return null;
    return root;
  };

  const fillHost = (hostSvg, markup) => {
    if (!hostSvg || !markup) return false;
    if (hostSvg.getAttribute("data-beam-cool") === "1" && hostSvg.querySelector("path,circle,rect,g")) return true;
    const root = parseSvg(markup);
    if (!root) return false;
    const w = hostSvg.getAttribute("width");
    const h = hostSvg.getAttribute("height");
    const cls = hostSvg.getAttribute("class");
    const style = hostSvg.getAttribute("style");
    while (hostSvg.firstChild) hostSvg.removeChild(hostSvg.firstChild);
    for (const { name, value } of [...root.attributes]) {
      if (name === "width" || name === "height" || name === "class" || name === "style") continue;
      hostSvg.setAttribute(name, value);
    }
    if (!hostSvg.getAttribute("viewBox")) hostSvg.setAttribute("viewBox", root.getAttribute("viewBox") || "0 0 24 24");
    if (w) hostSvg.setAttribute("width", w);
    if (h) hostSvg.setAttribute("height", h);
    if (cls) hostSvg.setAttribute("class", cls);
    if (style) hostSvg.setAttribute("style", style);
    hostSvg.setAttribute("data-beam-cool", "1");
    hostSvg.style.color = "inherit";
    hostSvg.style.opacity = "1";
    hostSvg.style.background = "none";
    hostSvg.style.webkitMask = "none";
    hostSvg.style.mask = "none";
    for (const node of [...root.childNodes]) hostSvg.appendChild(document.importNode(node, true));
    for (const u of hostSvg.querySelectorAll("use")) u.remove();
    return true;
  };

  const roleOf = (el) => {
    if (!el) return null;
    const tagged = el.getAttribute?.("data-beam-icon");
    if (tagged && DATA.byRole[tagged]) return tagged;
    const label = ((el.getAttribute?.("aria-label") || "") + " " + (el.innerText || "")).trim();
    if (!label || label.length > 100) return null;
    for (const [re, role] of RULES) {
      if (re.test(label) && DATA.byRole[role]) return role;
    }
    return null;
  };

  const applyRole = (el, role) => {
    if (!role || !DATA.byRole[role]) return 0;
    el.setAttribute("data-beam-icon", role);
    let n = 0;
    const svgs = el.matches?.("svg") ? [el] : [...(el.querySelectorAll?.("svg") || [])];
    for (const svg of svgs) {
      // skip huge decorative / chart svgs
      const vb = svg.getAttribute("viewBox") || "";
      if (svg.closest?.("svg[data-beam-cool='1']") && svg !== svg.closest("svg")) continue;
      if (fillHost(svg, DATA.byRole[role])) n++;
    }
    return n;
  };

  const replaceIn = (root) => {
    if (!root?.querySelectorAll) return;
    // 1) already tagged
    for (const el of root.querySelectorAll("[data-beam-icon]")) {
      applyRole(el, el.getAttribute("data-beam-icon"));
    }
    // 2) chrome buttons / glyphs
    const nodes = root.querySelectorAll(
      "button, [role='button'], [class*='panelRow'], [class*='panelGlyph'], [class*='iconButton'], [class*='panelIcon'], [class*='sendButton'], [class*='SendButton']"
    );
    for (const el of nodes) {
      if (el.closest?.("#beam-auth-gate")) continue;
      if (/newSessionLabel|newSessionContent|newSessionLabelMask|newSessionShortcut/i.test(String(el.className || ""))) continue;
      const role = roleOf(el);
      if (role) applyRole(el, role);
    }
    // 3) hard selectors
    for (const svg of root.querySelectorAll('.wtg9ga_newSession svg, button[class*="newSession"] svg')) {
      if (/Label|Content|Mask|Shortcut/i.test(String(svg.closest("button,span,div")?.className || ""))) {
        // still ok to replace the glyph svg inside the button
      }
      if (DATA.byRole.plus) fillHost(svg, DATA.byRole.plus);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Settings"] svg, button[aria-label*="Настрой"] svg')) {
      if (DATA.byRole.settings) fillHost(svg, DATA.byRole.settings);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Search"] svg, button[aria-label*="Поиск"] svg')) {
      if (DATA.byRole.search) fillHost(svg, DATA.byRole.search);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Send"] svg, button[aria-label*="Отправ"] svg, [class*="sendButton"] svg')) {
      if (DATA.byRole.send) fillHost(svg, DATA.byRole.send);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Attach"] svg, button[aria-label*="Прикреп"] svg, [class*="attach"] svg')) {
      if (DATA.byRole.attach) fillHost(svg, DATA.byRole.attach);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Copy"] svg, button[aria-label*="Копир"] svg')) {
      if (DATA.byRole.copy) fillHost(svg, DATA.byRole.copy);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Share"] svg, button[aria-label*="Подел"] svg')) {
      if (DATA.byRole.share) fillHost(svg, DATA.byRole.share);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Thumbs up"] svg, button[aria-label*="Нравится"] svg')) {
      if (DATA.byRole["thumbs-up"]) fillHost(svg, DATA.byRole["thumbs-up"]);
    }
    for (const svg of root.querySelectorAll('button[aria-label*="Thumbs down"] svg, button[aria-label*="Не нравится"] svg')) {
      if (DATA.byRole["thumbs-down"]) fillHost(svg, DATA.byRole["thumbs-down"]);
    }
  };

  let scheduled = false;
  const run = () => {
    scheduled = false;
    try { replaceIn(document); } catch (e) { console.warn("[beam-coolicons-v5]", e); }
  };
  const kick = () => { if (scheduled) return; scheduled = true; requestAnimationFrame(run); };
  const boot = () => {
    run();
    new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "class", "data-beam-icon"] });
    setInterval(run, 800);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>`;
}

const { byRole, missing } = buildByRole();
console.log("roles", Object.keys(byRole).length, "missing", missing);
const script = makeScript(byRole);

let n = 0;
for (const web of WEBS) {
  const htmlPath = path.join(web, "index.html");
  const cssPath = path.join(web, "assets/beam-override.css");
  if (!fs.existsSync(htmlPath)) {
    console.log("skip", path.relative(ROOT, web));
    continue;
  }
  if (fs.existsSync(cssPath)) {
    fs.writeFileSync(cssPath, nukeCss(fs.readFileSync(cssPath, "utf8")));
  }
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(/<script id="beam-coolicons-force">[\s\S]*?<\/script>\s*/g, "");
  html = html.replace(/<script id="beam-coolicons-sprite">[\s\S]*?<\/script>\s*/g, "");
  if (html.includes("</body>")) html = html.replace("</body>", script + "\n</body>");
  else html += "\n" + script + "\n";
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=coolforce7"'
  );
  fs.writeFileSync(htmlPath, html);

  // Also dump fill assets for any residual mask CSS
  const bold = path.join(web, "assets/beam-icons/bold");
  const fill = path.join(web, "assets/beam-icons/fill");
  fs.mkdirSync(bold, { recursive: true });
  fs.mkdirSync(fill, { recursive: true });
  for (const [role, cool] of Object.entries(ROLE_MAP)) {
    const raw = readCool(cool);
    if (!raw) continue;
    const fillRaw = fs.existsSync(path.join(FILL, `${cool}.svg`))
      ? fs.readFileSync(path.join(FILL, `${cool}.svg`), "utf8")
      : raw;
    const cleaned = fillRaw.replace(/\s(width|height)="[^"]*"/g, "");
    fs.writeFileSync(path.join(bold, `${cool}.svg`), cleaned);
    fs.writeFileSync(path.join(fill, `${cool}.svg`), cleaned);
    fs.writeFileSync(path.join(bold, `${role}.svg`), cleaned);
    fs.writeFileSync(path.join(fill, `${role}.svg`), cleaned);
  }

  n++;
  console.log("patched", path.relative(ROOT, web));
}

fs.writeFileSync(
  path.join(ROOT, "desktop/_coolicons-force-report.json"),
  JSON.stringify({ version: 5, roles: Object.keys(byRole).length, missing, patched: n }, null, 2)
);
console.log("V5 DONE", n);
