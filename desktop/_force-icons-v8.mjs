/**
 * Coolicons V8 — surgical:
 * - Replace ONLY small chrome glyph SVGs (one per control)
 * - NEVER touch usage gauges / meters / charts / text-in-svg
 * - No 800ms polling (was freezing the UI)
 * - Narrow label rules (no file→paperclip on profile)
 * - Soft CSS (no force-opacity on every button svg *)
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
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

/** role → coolicon basename (line/duocolor preferred — less “fat blob” than fill) */
const ROLE_MAP = {
  plus: "plus",
  send: "paper-plane",
  attach: "paperclip",
  plugins: "grid",
  automation: "clock",
  more: "more-horizontal",
  workspace: "folder",
  search: "search",
  refresh: "reload",
  logout: "log-out",
  login: "log-in",
  settings: "settings",
  copy: "copy",
  share: "share",
  "thumbs-up": "thumbs-up",
  "thumbs-down": "thumbs-down",
  bell: "bell",
  edit: "pencil",
  trash: "trash",
  user: "user",
  profile: "user",
  account: "user",
  microphone: "microphone",
  archive: "archive",
  pin: "pin",
  collapse: "panel-left",
  expand: "panel-right",
  options: "more-horizontal",
  "add-project": "folder-plus",
  fullscreen: "expand",
  split: "columns",
  "new-tab": "plus",
  model: "sparkle",
  "open-right": "panel-right",
};

/** Order matters — more specific first. NO limits/usage. NO bare "file". */
const LABEL_RULES = [
  [/плагин|plugin/i, "plugins"],
  [/автоматиз|automation|schedule|задач/i, "automation"],
  [/новая сессия|new session|new chat|новый чат/i, "plus"],
  [/добавить проект|add project/i, "add-project"],
  [/прикреп|attach|paperclip|скрепк/i, "attach"],
  [/поиск|search session|search/i, "search"],
  [/настрой|settings/i, "settings"],
  [/отправ|send message|send/i, "send"],
  [/профиль|profile|account|аккаунт|аватар/i, "user"],
  [/войти|sign in|login/i, "login"],
  [/выйти|sign out|logout/i, "logout"],
  [/копир|copy/i, "copy"],
  [/подел|share/i, "share"],
  [/архив|archive/i, "archive"],
  [/закреп|pin session|unpin|откреп/i, "pin"],
  [/свернуть боков|collapse sidebar/i, "collapse"],
  [/правую боков|right sidebar|open right|collapse right/i, "open-right"],
  [/параметр|view options/i, "options"],
  [/полноэкран|fullscreen/i, "fullscreen"],
  [/раздел|split/i, "split"],
  [/новая вклад|new tab/i, "new-tab"],
  [/редактир|edit project|rename/i, "edit"],
  [/модель|model,/i, "model"],
  [/микрофон|microphone|voice/i, "microphone"],
  [/удал|trash|delete/i, "trash"],
  [/ещё|more|apps add/i, "more"],
];

function readCool(name) {
  // line = clean outline; duo = accent; fill last (can look chunky at 14px)
  for (const dir of [LINE, DUO, FILL]) {
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
  s = s.replace(/\sstroke="(?!currentColor|none)[^"]*"/g, ' stroke="currentColor"');
  s = s.replace(/\sfill="(?!currentColor|none)[^"]*"/g, ' fill="currentColor"');
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

function softCss(css) {
  let s = css;
  // Remove previous aggressive FORCE blocks that nuked gauge visibility
  s = s.replace(/\/\* ===== BEAM coolicons FORCE[\s\S]*?(?=\/\* =====|$)/g, "");
  // Soften any leftover "all button svg * opacity 1" from older patches if present as our block only

  if (!s.includes("BEAM coolicons FORCE V8")) {
    s += `

/* ===== BEAM coolicons FORCE V8 ===== */
svg[data-beam-cool="1"] {
  color: inherit !important;
  background: none !important;
  -webkit-mask: none !important;
  mask: none !important;
  overflow: visible !important;
}
svg[data-beam-cool="1"] path[stroke] {
  stroke: currentColor !important;
}
svg[data-beam-cool="1"] path[fill]:not([fill="none"]) {
  fill: currentColor !important;
}
/* Do NOT force opacity on arbitrary button svg* — that wrecks usage gauges */
`;
  }
  return s;
}

function makeScript(byRole) {
  const json = JSON.stringify({
    byRole,
    rules: LABEL_RULES.map(([re, role]) => [String(re), role]),
  });
  return `<script id="beam-coolicons-force">
(() => {
  if (window.__beamCooliconsForceV8) return;
  window.__beamCooliconsForceV8 = true;
  // disable older loops if somehow still present
  window.__beamCooliconsForceV7 = true;
  window.__beamCooliconsForceV6 = true;
  window.__beamCooliconsForceV5 = true;

  const DATA = ${json};
  const RULES = DATA.rules.map(([src, role]) => {
    const last = src.lastIndexOf("/");
    return [new RegExp(src.slice(1, last), src.slice(last + 1)), role];
  });

  const parseSvg = (markup) => {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() === "parsererror") return null;
    return root;
  };

  const isMeterOrChart = (svg) => {
    if (!svg) return true;
    // progress rings / usage gauges / charts
    if (svg.querySelector("text, tspan")) return true;
    if (svg.querySelector("[stroke-dasharray], [stroke-dashoffset]")) return true;
    if (svg.querySelector("circle[r]") && svg.querySelectorAll("circle").length >= 1 && svg.querySelectorAll("path").length >= 2) {
      // likely ring + icon; still careful — usage meters often have circle + path
      const label = (svg.closest("button,[role=button]")?.getAttribute("aria-label") || "") + " " + (svg.closest("button")?.innerText || "");
      if (/Tide|Flare|Pine|%|\\dK\\s*\\/|limit|usage|quota|лимит/i.test(label)) return true;
    }
    const cls = String(svg.getAttribute("class") || "") + " " + String(svg.parentElement?.className || "");
    if (/meter|gauge|progress|usage|quota|ring|chart|sparkline/i.test(cls)) return true;
    // many children = not a simple glyph
    if (svg.querySelectorAll("path,circle,rect,polyline,polygon,g").length > 8) return true;
    return false;
  };

  const isSmallGlyph = (svg) => {
    if (!svg || isMeterOrChart(svg)) return false;
    if (svg.getAttribute("data-beam-cool") === "1") return false;
    const rect = svg.getBoundingClientRect?.();
    if (rect && (rect.width > 40 || rect.height > 40)) return false;
    const w = parseFloat(svg.getAttribute("width") || "0");
    const h = parseFloat(svg.getAttribute("height") || "0");
    if ((w && w > 40) || (h && h > 40)) return false;
    return true;
  };

  const fillHost = (hostSvg, markup) => {
    if (!hostSvg || !markup) return false;
    if (hostSvg.getAttribute("data-beam-cool") === "1") return true;
    if (isMeterOrChart(hostSvg)) return false;
    const root = parseSvg(markup);
    if (!root) return false;
    const w = hostSvg.getAttribute("width");
    const h = hostSvg.getAttribute("height");
    const cls = hostSvg.getAttribute("class");
    const ariaHidden = hostSvg.getAttribute("aria-hidden");
    while (hostSvg.firstChild) hostSvg.removeChild(hostSvg.firstChild);
    for (const { name, value } of [...root.attributes]) {
      if (name === "width" || name === "height" || name === "class" || name === "style") continue;
      hostSvg.setAttribute(name, value);
    }
    hostSvg.setAttribute("viewBox", root.getAttribute("viewBox") || "0 0 24 24");
    if (w) hostSvg.setAttribute("width", w);
    if (h) hostSvg.setAttribute("height", h);
    if (cls) hostSvg.setAttribute("class", cls);
    if (ariaHidden != null) hostSvg.setAttribute("aria-hidden", ariaHidden);
    hostSvg.setAttribute("data-beam-cool", "1");
    hostSvg.style.background = "none";
    hostSvg.style.webkitMask = "none";
    hostSvg.style.mask = "none";
    for (const node of [...root.childNodes]) hostSvg.appendChild(document.importNode(node, true));
    for (const u of hostSvg.querySelectorAll("use")) u.remove();
    return true;
  };

  const roleOf = (el) => {
    if (!el) return null;
    // never icon-replace usage / limits plaque
    const lab0 = ((el.getAttribute?.("aria-label") || "") + " " + (el.innerText || "")).trim();
    if (/Tide|Flare|Pine|Limits|лимит|quota|usage|\\d+\\s*%/i.test(lab0) && /\\d/.test(lab0)) return null;

    const tagged = el.getAttribute?.("data-beam-icon");
    if (tagged === "limits") {
      el.removeAttribute("data-beam-icon");
      return null;
    }
    if (tagged && DATA.byRole[tagged]) return tagged;

    const label = lab0;
    if (!label || label.length > 90) return null;
    for (const [re, role] of RULES) {
      if (re.test(label) && DATA.byRole[role]) return role;
    }
    return null;
  };

  const pickGlyph = (el) => {
    const svgs = [...(el.querySelectorAll?.("svg") || [])].filter(isSmallGlyph);
    if (!svgs.length) return null;
    // prefer explicit icon classes
    const preferred = svgs.find((s) => /icon|glyph|panelIcon|panelGlyph/i.test(String(s.getAttribute("class") || "") + String(s.parentElement?.className || "")));
    return preferred || svgs[0];
  };

  const applyRole = (el, role) => {
    if (!role || !DATA.byRole[role]) return false;
    // strip mistaken limits tags
    if (role === "limits") return false;
    el.setAttribute("data-beam-icon", role);
    const svg = pickGlyph(el);
    if (!svg) return false;
    return fillHost(svg, DATA.byRole[role]);
  };

  const HARD = [
    ['button[aria-label*="Settings"] svg, button[aria-label*="Настрой"] svg', "settings"],
    ['button[aria-label*="Search"] svg, button[aria-label*="Поиск"] svg', "search"],
    ['button[aria-label*="Send"] svg, button[aria-label*="Отправ"] svg', "send"],
    ['button[aria-label*="Attach"] svg, button[aria-label*="Прикреп"] svg', "attach"],
    ['button[aria-label*="Copy"] svg, button[aria-label*="Копир"] svg', "copy"],
    ['button[aria-label*="Share"] svg, button[aria-label*="Подел"] svg', "share"],
    ['.wtg9ga_newSession svg, button[class*="newSession"] svg', "plus"],
  ];

  const replaceIn = (root) => {
    if (!root?.querySelectorAll) return;

    // Untag / skip limits plaques forever
    for (const el of root.querySelectorAll('[data-beam-icon="limits"], button[aria-label*="Limits"], button[aria-label*="Tide"]')) {
      el.removeAttribute("data-beam-icon");
    }

    const nodes = root.querySelectorAll(
      "button, [role='button'], [class*='panelGlyph'], [class*='iconButton'], [class*='panelIcon']"
    );
    for (const el of nodes) {
      if (el.closest?.("#beam-auth-gate")) continue;
      if (/newSessionLabel|newSessionContent|newSessionLabelMask|newSessionShortcut/i.test(String(el.className || ""))) continue;
      const role = roleOf(el);
      if (role) applyRole(el, role);
    }

    for (const [sel, role] of HARD) {
      if (!DATA.byRole[role]) continue;
      for (const svg of root.querySelectorAll(sel)) {
        if (!isSmallGlyph(svg) && svg.getAttribute("data-beam-cool") !== "1") continue;
        const host = svg.closest("button, [role='button']") || svg.parentElement;
        if (host && /Tide|Flare|Pine|Limits/i.test((host.getAttribute("aria-label") || "") + host.innerText)) continue;
        fillHost(svg, DATA.byRole[role]);
      }
    }
  };

  let scheduled = false;
  const run = () => {
    scheduled = false;
    try {
      replaceIn(document);
    } catch (e) {
      console.warn("[beam-coolicons-v8]", e);
    }
  };
  const kick = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };

  const boot = () => {
    run();
    // childList only — attribute spam was thrashing React
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) {
          kick();
          return;
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
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
    fs.writeFileSync(cssPath, softCss(fs.readFileSync(cssPath, "utf8")));
  }
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(/<script id="beam-coolicons-force">[\s\S]*?<\/script>\s*/g, "");
  html = html.replace(/<script id="beam-coolicons-sprite">[\s\S]*?<\/script>\s*/g, "");
  if (html.includes("</body>")) html = html.replace("</body>", script + "\n</body>");
  else html += "\n" + script + "\n";
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=coolforce8"'
  );
  fs.writeFileSync(htmlPath, html);
  n++;
  console.log("patched", path.relative(ROOT, web));
}

// Keep boot-hidden rule
for (const web of WEBS) {
  const cssPath = path.join(web, "assets/beam-override.css");
  if (!fs.existsSync(cssPath)) continue;
  let css = fs.readFileSync(cssPath, "utf8");
  if (!css.includes("BEAM boot must honor hidden")) {
    css += `

/* ===== BEAM boot must honor hidden ===== */
[data-dsh-boot][hidden],
[data-beam-boot][hidden],
[class*="_boot_"][hidden],
#beam-early-splash[hidden] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  min-height: 0 !important;
}
`;
    fs.writeFileSync(cssPath, css);
  }
}

fs.writeFileSync(
  path.join(ROOT, "desktop/_coolicons-force-report.json"),
  JSON.stringify({ version: 8, roles: Object.keys(byRole).length, missing, patched: n }, null, 2)
);
console.log("V8 DONE", n, "missing", missing);
