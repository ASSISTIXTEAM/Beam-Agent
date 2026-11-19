/**
 * Fix stale Settings/Profile/Start icons + missing titlebar New Chat.
 * - Emit real .png masks next to PNG-in-SVG wrappers (Chromium-safe)
 * - Retarget beam-override.css mask urls to .png
 * - Harden collapsed titlebar New Chat with PNG mask + CSS plus fallback
 * - Replace Start guide artwork with coolicons duocolor PNGs (full color)
 * - Expand settings/profile icon CSS + injector tagging
 * - Cache-bust without touching brand logo/typography rules
 * - Sync assistix + dsh × runtime + dist + BeamAgent
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sharp = require(
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/sharp")
);

const CACHE_BUST = "icons-newchat-v3";
const COOL = path.join(ROOT, "desktop/_coolicons_svg/package/duocolor/round");

const FRONTENDS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "../BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "../BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
];

const ICON_DIRS = FRONTENDS.map((d) => path.join(d, "assets/beam-icons")).filter(
  (d, i, a) => a.indexOf(d) === i
);

function uniqExisting(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const n = path.normalize(p);
    if (seen.has(n)) continue;
    seen.add(n);
    if (fs.existsSync(n)) out.push(n);
  }
  return out;
}

async function extractPngFromWrapper(svgPath, pngPath) {
  const svg = fs.readFileSync(svgPath, "utf8");
  const m = svg.match(/href="(data:image\/png;base64,[^"]+)"/);
  if (!m) return false;
  const buf = Buffer.from(m[1].replace("data:image/png;base64,", ""), "base64");
  await sharp(buf).png().toFile(pngPath);
  return true;
}

async function rasterCool(name, outPng, size = 64) {
  const src = path.join(COOL, `${name}.svg`);
  if (!fs.existsSync(src)) return null;
  let svg = fs.readFileSync(src, "utf8");
  // Keep duocolor opacity; force paint to black for mask variants
  const maskSvg = svg
    .replace(/stroke="currentColor"/g, 'stroke="#000"')
    .replace(/fill="currentColor"/g, 'fill="#000"');
  const buf = await sharp(Buffer.from(maskSvg))
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();
  fs.writeFileSync(outPng, buf);
  return buf;
}

async function ensurePngMasks(iconDir) {
  const bold = path.join(iconDir, "bold");
  const fill = path.join(iconDir, "fill");
  let n = 0;
  for (const dir of [bold, fill]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".svg")) continue;
      const svgPath = path.join(dir, f);
      const pngPath = path.join(dir, f.replace(/\.svg$/, ".png"));
      const ok = await extractPngFromWrapper(svgPath, pngPath);
      if (ok) n++;
    }
  }
  // Ensure key Start/chrome icons exist even if wrappers missing
  const ensure = [
    ["plus", "bold"],
    ["folder", "bold"],
    ["terminal", "bold"],
    ["globe", "bold"],
    ["compass", "bold"],
    ["settings", "bold"],
    ["user", "bold"],
    ["search", "bold"],
    ["window-sidebar", "bold"],
    ["expand", "bold"],
    ["window", "bold"],
    ["slider-2", "bold"],
    ["folder-plus", "bold"],
    ["paperclip", "bold"],
    ["paper-plane", "bold"],
    ["clock", "bold"],
    ["chevron-down", "bold"],
    ["close", "bold"],
  ];
  for (const [name, kind] of ensure) {
    const dir = path.join(iconDir, kind);
    fs.mkdirSync(dir, { recursive: true });
    const pngPath = path.join(dir, `${name}.png`);
    if (!fs.existsSync(pngPath)) {
      const buf = await rasterCool(name, pngPath);
      if (buf) n++;
    }
    // also keep svg wrapper pointing at png for any remaining svg refs
    const svgPath = path.join(dir, `${name}.svg`);
    if (fs.existsSync(pngPath)) {
      const b64 = fs.readFileSync(pngPath).toString("base64");
      const wrap = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><image href="data:image/png;base64,${b64}" width="24" height="24" preserveAspectRatio="xMidYMid meet"/></svg>`;
      fs.writeFileSync(svgPath, wrap);
    }
  }

  // Colored Start guide sprites
  const guideDir = path.join(iconDir, "guide");
  fs.mkdirSync(guideDir, { recursive: true });
  const guideMap = {
    files: "folder",
    terminal: "terminal",
    browser: "globe",
    hero: "compass",
  };
  // tinted variants
  const tints = {
    files: "#F5A524",
    terminal: "#3CC6C4",
    browser: "#679EFE",
    hero: "#6B7C7A",
  };
  for (const [key, cool] of Object.entries(guideMap)) {
    const src = path.join(COOL, `${cool}.svg`);
    if (!fs.existsSync(src)) continue;
    let svg = fs.readFileSync(src, "utf8");
    svg = svg
      .replace(/stroke="currentColor"/g, `stroke="${tints[key]}"`)
      .replace(/fill="currentColor"/g, `fill="${tints[key]}"`);
    const buf = await sharp(Buffer.from(svg))
      .resize(72, 72, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(guideDir, `${key}.png`), buf);
    n++;
  }
  return n;
}

function plusPngDataUri(iconDir) {
  const p = path.join(iconDir, "bold/plus.png");
  if (!fs.existsSync(p)) return null;
  return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
}

function patchCss(css, plusDataUri) {
  let s = css;
  // Do NOT touch brand logo / Savona Brand Title blocks.

  // Retarget mask urls: beam-icons/**/*.svg → .png (bold+fill only)
  s = s.replace(
    /(url\("\.\/beam-icons\/(?:bold|fill)\/[a-z0-9-]+)\.svg("\))/g,
    "$1.png$2"
  );

  // Remove prior harden / v3 blocks to avoid stacking
  s = s.replace(
    /\n?\/\* ===== BEAM duocolor chrome harden \(newSession titlebar\) ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g,
    "\n"
  );
  s = s.replace(
    /\n?\/\* ===== BEAM icons-newchat-v3 ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g,
    "\n"
  );

  const plusMask = plusDataUri
    ? `url("${plusDataUri}")`
    : 'url("./beam-icons/bold/plus.png")';

  const block = `
/* ===== BEAM icons-newchat-v3 ===== */
/* Collapsed-right/chats panel: New Chat must stay visible in titlebar (left:48px slot) */
html[data-windows-titlebar]:has([data-sidebar-collapsed="true"]) button.wtg9ga_newSession,
html[data-windows-titlebar]:has([data-sidebar-collapsed="true"]) button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]),
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession,
[data-windows-titlebar] .wtg9ga_collapsed button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"]),
#beam-titlebar-newchat {
  position: fixed !important;
  left: 48px !important;
  top: calc((var(--dsh-windows-titlebar-height, 40px) - 28px) / 2) !important;
  z-index: 120 !important;
  -webkit-app-region: no-drag !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  border-radius: var(--dsw-radius-sm, 8px) !important;
  background: transparent !important;
  color: var(--dsw-alias-label-secondary, #c5cdca) !important;
  opacity: 1 !important;
  visibility: visible !important;
  overflow: visible !important;
  pointer-events: auto !important;
  cursor: pointer !important;
}
html[data-windows-titlebar]:has([data-sidebar-collapsed="true"]) button.wtg9ga_newSession::before,
html[data-windows-titlebar]:has([data-sidebar-collapsed="true"]) button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"])::before,
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession::before,
[data-windows-titlebar] .wtg9ga_collapsed button[class*="newSession"]:not([class*="Label"]):not([class*="Content"]):not([class*="Mask"]):not([class*="Shortcut"])::before,
#beam-titlebar-newchat::before {
  content: "" !important;
  display: block !important;
  width: 16px !important;
  height: 16px !important;
  flex: none !important;
  background-color: currentColor !important;
  -webkit-mask: ${plusMask} center / contain no-repeat !important;
  mask: ${plusMask} center / contain no-repeat !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: none !important;
}
/* Hide nested SVG hosts in collapsed titlebar slot — ::before owns the glyph */
html[data-windows-titlebar]:has([data-sidebar-collapsed="true"]) button.wtg9ga_newSession svg,
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession svg,
html[data-windows-titlebar]:has([data-sidebar-collapsed="true"]) button.wtg9ga_newSession [class*="newSessionLabel"],
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession [class*="newSessionLabel"],
html[data-windows-titlebar]:has([data-sidebar-collapsed="true"]) button.wtg9ga_newSession [class*="newSessionShortcut"],
[data-windows-titlebar] .wtg9ga_collapsed button.wtg9ga_newSession [class*="newSessionShortcut"] {
  position: absolute !important;
  width: 0 !important;
  height: 0 !important;
  opacity: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
}
/* Expanded sidebar New Chat glyph — PNG mask */
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
  -webkit-mask: url("./beam-icons/bold/plus.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.png") center / contain no-repeat !important;
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

/* Start / home empty-state guide entries → coolicons duocolor (colored PNGs) */
[class*="_guide"] [class*="_hero"] svg,
[class*="p2k40q_hero"] svg,
[class*="_guide"] [class*="_hero"] > *,
[class*="p2k40q_hero"] > * {
  opacity: 0 !important;
}
[class*="_guide"] [class*="_hero"],
[class*="p2k40q_hero"] {
  position: relative !important;
  width: 56px !important;
  height: 56px !important;
}
[class*="_guide"] [class*="_hero"]::before,
[class*="p2k40q_hero"]::before {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  background: url("./beam-icons/guide/hero.png") center / contain no-repeat !important;
  opacity: 0.55 !important;
  pointer-events: none !important;
}
/* Guide entry icon hosts: hide stock artwork, paint coolicons */
[class*="_guide"] [class*="_entry"] [class*="_icon"] > svg,
[class*="p2k40q_entry"] [class*="_icon"] > svg,
[class*="_entry"][class*="GESq"] [class*="_icon"] > svg,
[class*="-4GESq_icon"] > svg,
[class*="GESq_icon"] > svg {
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
}
[class*="_guide"] [class*="_entry"] [class*="_icon"],
[class*="p2k40q_entry"] [class*="_icon"],
[class*="-4GESq_icon"],
[class*="GESq_icon"] {
  position: relative !important;
  width: 26px !important;
  height: 26px !important;
  flex: none !important;
}
[class*="_guide"] [class*="_entry"] [class*="_icon"]::before,
[class*="p2k40q_entry"] [class*="_icon"]::before,
[class*="-4GESq_icon"]::before,
[class*="GESq_icon"]::before {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  background: url("./beam-icons/guide/files.png") center / contain no-repeat !important;
  pointer-events: none !important;
}
/* nth-of-type fallbacks for Start guide order: files → terminal → browser */
[class*="_guide"] > [class*="_entry"]:nth-of-type(1) [class*="_icon"]::before,
[class*="p2k40q_guide"] > [class*="_entry"]:nth-of-type(1) [class*="_icon"]::before,
[class*="_guide"] > button:nth-of-type(1) [class*="_icon"]::before {
  background-image: url("./beam-icons/guide/files.png") !important;
}
[class*="_guide"] > [class*="_entry"]:nth-of-type(2) [class*="_icon"]::before,
[class*="p2k40q_guide"] > [class*="_entry"]:nth-of-type(2) [class*="_icon"]::before,
[class*="_guide"] > button:nth-of-type(2) [class*="_icon"]::before {
  background-image: url("./beam-icons/guide/terminal.png") !important;
}
[class*="_guide"] > [class*="_entry"]:nth-of-type(3) [class*="_icon"]::before,
[class*="p2k40q_guide"] > [class*="_entry"]:nth-of-type(3) [class*="_icon"]::before,
[class*="_guide"] > button:nth-of-type(3) [class*="_icon"]::before {
  background-image: url("./beam-icons/guide/browser.png") !important;
}
/* data-beam-guide tags (injector) — override nth when present */
[data-beam-guide="files"] [class*="_icon"]::before { background-image: url("./beam-icons/guide/files.png") !important; }
[data-beam-guide="terminal"] [class*="_icon"]::before { background-image: url("./beam-icons/guide/terminal.png") !important; }
[data-beam-guide="browser"] [class*="_icon"]::before { background-image: url("./beam-icons/guide/browser.png") !important; }

/* Start tab chrome: split / fullscreen / right sidebar */
[class*="header"] button[aria-label*="split" i] svg,
[class*="header"] button[aria-label*="Split" i] svg,
[class*="header"] button[aria-label*="columns" i] svg,
button[aria-label*="Maximize" i] svg,
button[aria-label*="Fullscreen" i] svg,
button[aria-label*="полный экран" i] svg,
button[aria-label*="Collapse right" i] svg,
button[aria-label*="Expand right" i] svg,
button[aria-label*="правую" i] svg,
button[aria-label*="Open right" i] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/window.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/window.png") center / contain no-repeat !important;
}
button[aria-label*="Maximize" i] svg,
button[aria-label*="Fullscreen" i] svg,
button[aria-label*="полный экран" i] svg {
  -webkit-mask: url("./beam-icons/bold/expand.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/expand.png") center / contain no-repeat !important;
}
button[aria-label*="Collapse right" i] svg,
button[aria-label*="Expand right" i] svg,
button[aria-label*="правую" i] svg,
button[aria-label*="Open right" i] svg,
button[aria-label*="right sidebar" i] svg {
  -webkit-mask: url("./beam-icons/bold/window-sidebar.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/window-sidebar.png") center / contain no-repeat !important;
}
button[aria-label*="Maximize" i] svg *,
button[aria-label*="Fullscreen" i] svg *,
button[aria-label*="полный экран" i] svg *,
button[aria-label*="Collapse right" i] svg *,
button[aria-label*="Expand right" i] svg *,
button[aria-label*="правую" i] svg *,
button[aria-label*="Open right" i] svg *,
button[aria-label*="right sidebar" i] svg *,
[class*="header"] button[aria-label*="split" i] svg *,
[class*="header"] button[aria-label*="columns" i] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}

/* Settings: force coolicons on common settings nav / row glyphs */
[class*="settings"] button svg,
[class*="Settings"] button svg,
[role="dialog"][class*="settings"] svg,
[class*="settingsShell"] svg,
[class*="SettingsShell"] svg,
[class*="settingsNav"] svg,
[data-beam-icon="settings"] svg,
[data-beam-icon="user"] svg,
[data-beam-icon="model"] svg,
[data-beam-icon="mic"] svg,
[data-beam-icon="archive"] svg,
[data-beam-icon="search"] svg,
[data-beam-icon="sliders"] svg,
#beam-profile-modal svg,
#beam-profile-modal .bpm-close svg,
.bsl-gear .bsl-gear-ico {
  color: inherit !important;
}
/* Profile gear host */
#beam-side-limits .bsl-gear .bsl-gear-ico {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
  flex: none !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  opacity: 1 !important;
  visibility: visible !important;
}
#beam-side-limits .bsl-gear svg { display: none !important; }

/* Settings section icons by data-beam-icon */
[data-beam-icon="user"] > svg,
[data-beam-icon="user"] svg,
button[data-beam-icon="user"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
}
[data-beam-icon="user"] svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }
[data-beam-icon="settings"] > svg,
[data-beam-icon="settings"] svg,
button[data-beam-icon="settings"] svg,
.bsl-gear svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
}
[data-beam-icon="settings"] svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }
[data-beam-icon="search"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/search.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/search.png") center / contain no-repeat !important;
}
[data-beam-icon="search"] svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }
[data-beam-icon="mic"] svg,
[data-beam-icon="microphone"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/microphone.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/microphone.png") center / contain no-repeat !important;
}
[data-beam-icon="mic"] svg *,
[data-beam-icon="microphone"] svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }
[data-beam-icon="archive"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/archive.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/archive.png") center / contain no-repeat !important;
}
[data-beam-icon="archive"] svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }
[data-beam-icon="model"] svg,
[data-beam-icon="chip"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/cpu.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/cpu.png") center / contain no-repeat !important;
}
[data-beam-icon="model"] svg *,
[data-beam-icon="chip"] svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }
[data-beam-icon="sliders"] svg,
[data-beam-icon="settings-sliders"] svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/slider-2.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/slider-2.png") center / contain no-repeat !important;
}
[data-beam-icon="sliders"] svg *,
[data-beam-icon="settings-sliders"] svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }
[data-beam-icon="close"] svg,
#beam-profile-modal .bpm-close svg {
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/close.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/close.png") center / contain no-repeat !important;
}
[data-beam-icon="close"] svg *,
#beam-profile-modal .bpm-close svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }

/* Titlebar sidebar toggle */
[data-windows-titlebar] .wtg9ga_toggle svg,
[data-windows-titlebar] button.wtg9ga_toggle svg,
.wtg9ga_toggle svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/window-sidebar.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/window-sidebar.png") center / contain no-repeat !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
[data-windows-titlebar] .wtg9ga_toggle svg *,
[data-windows-titlebar] button.wtg9ga_toggle svg *,
.wtg9ga_toggle svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
`;

  return s.trimEnd() + "\n" + block + "\n";
}

function patchHtml(html) {
  let h = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE_BUST}"`
  );

  // Expand icon tagger rules for settings/profile; never tag newSession hosts as plus
  if (!h.includes("/* beam-icons-newchat-v3-tagger */")) {
    const taggerHook = `const beamTagIcons = () => {
beamStripNewSessionIconHosts();`;
    const replacement = `const beamTagIcons = () => {
/* beam-icons-newchat-v3-tagger */
beamStripNewSessionIconHosts();
try {
  // Tag Start guide entries for coolicons sprites
  for (const entry of document.querySelectorAll('[class*="_guide"] [class*="_entry"], [class*="p2k40q_guide"] [class*="_entry"], [class*="p2k40q_guide"] > button, [class*="_guide"] > button')) {
    const t = ((entry.innerText || "") + " " + (entry.getAttribute("aria-label") || "")).toLowerCase();
    if (/terminal|терминал|команд/.test(t)) entry.setAttribute("data-beam-guide", "terminal");
    else if (/browser|браузер|web page|веб/.test(t)) entry.setAttribute("data-beam-guide", "browser");
    else if (/file|файл|project|проект|workspace|рабоч/.test(t)) entry.setAttribute("data-beam-guide", "files");
  }
} catch {}
`;
    if (h.includes(taggerHook)) h = h.replace(taggerHook, replacement);
  }

  // Skip tagging the newSession button itself (keeps label CSS clean; titlebar uses ::before)
  if (!h.includes("/* beam-skip-newsession-tag */")) {
    h = h.replace(
      `for (const el of nodes) {
      if (el.closest("#beam-auth-gate,#beam-side-limits")) continue;`,
      `for (const el of nodes) {
      if (el.closest("#beam-auth-gate,#beam-side-limits")) continue;
      /* beam-skip-newsession-tag */
      if (el.classList && [...el.classList].some((c) => /newSession$/i.test(c) || c === "wtg9ga_newSession")) continue;
      if (/newSession/i.test(String(el.className || "")) && !/Label|Content|Mask|Shortcut/i.test(String(el.className || ""))) continue;`
    );
  }

  // Expand settings-oriented tag rules
  if (!h.includes("/* beam-settings-icon-rules-v3 */")) {
    h = h.replace(
      `[/настрой|settings/i, "settings"],`,
      `/* beam-settings-icon-rules-v3 */
      [/настрой|settings|preferences|параметр/i, "settings"],
      [/профиль|profile|account|аккаунт|user|пользовател/i, "user"],
      [/модел|model|llm|tide|flare|pine/i, "model"],
      [/микрофон|microphone|voice|голос/i, "mic"],
      [/архив|archive/i, "archive"],
      [/персонал|personalization|агент.?preset|agent preset/i, "sliders"],
      [/данн|data|storage|хранен/i, "archive"],
      [/закрыть|close/i, "close"],
      [/настрой|settings/i, "settings"],`
    );
  }

  // Inject titlebar New Chat fallback controller once
  if (!h.includes("beam-titlebar-newchat-v3")) {
    const inject = `
<script id="beam-titlebar-newchat-v3">
(() => {
  const ensure = () => {
    try {
      const collapsed = !!document.querySelector('[data-sidebar-collapsed="true"], .wtg9ga_root.wtg9ga_collapsed, [class*="wtg9ga_collapsed"]');
      const titlebar = document.documentElement.hasAttribute("data-windows-titlebar");
      let btn = document.getElementById("beam-titlebar-newchat");
      if (!(titlebar && collapsed)) {
        if (btn) btn.remove();
        return;
      }
      const native = document.querySelector('button.wtg9ga_newSession, button[class*="newSession"]:not([class*="Label"]):not([class*="Content"])');
      // If native is present and has non-zero box, keep it — CSS paints ::before
      if (native) {
        const r = native.getBoundingClientRect();
        if (r.width >= 20 && r.height >= 20 && r.left > 0 && r.left < 120) {
          if (btn) btn.remove();
          return;
        }
      }
      if (!btn) {
        btn = document.createElement("button");
        btn.id = "beam-titlebar-newchat";
        btn.type = "button";
        btn.setAttribute("aria-label", "New session");
        btn.title = "New session (Ctrl+N)";
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const n = document.querySelector('button.wtg9ga_newSession, button[class*="newSession"]:not([class*="Label"]):not([class*="Content"])');
          if (n) { n.click(); return; }
          // Fallback: synthesize Ctrl+N
          try {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "n", code: "KeyN", ctrlKey: true, bubbles: true }));
          } catch {}
        });
        document.documentElement.appendChild(btn);
      }
    } catch {}
  };
  const mo = new MutationObserver(() => ensure());
  const start = () => {
    ensure();
    try { mo.observe(document.documentElement, { attributes: true, subtree: true, childList: true, attributeFilter: ["class", "data-sidebar-collapsed"] }); } catch {}
    setInterval(ensure, 1500);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>
`;
    if (h.includes("</body>")) h = h.replace("</body>", inject + "\n</body>");
    else h += inject;
  }

  return h;
}

async function main() {
  const iconDirs = uniqExisting(ICON_DIRS);
  console.log("icon dirs", iconDirs.length);
  let plusUri = null;
  for (const dir of iconDirs) {
    const n = await ensurePngMasks(dir);
    console.log("pngs", path.relative(ROOT, dir), n);
    if (!plusUri) plusUri = plusPngDataUri(dir);
  }

  // Also ensure microphone/cpu/archive exist
  for (const dir of iconDirs) {
    for (const name of ["microphone", "cpu", "archive", "window", "expand", "slider-2", "close", "user", "search", "settings", "folder-plus", "compass", "terminal", "globe"]) {
      const png = path.join(dir, "bold", `${name}.png`);
      if (!fs.existsSync(png)) await rasterCool(name, png);
    }
  }

  const cssPaths = uniqExisting(
    FRONTENDS.map((d) => path.join(d, "assets/beam-override.css"))
  );
  for (const cssPath of cssPaths) {
    const before = fs.readFileSync(cssPath, "utf8");
    // Preserve brand markers
    const hasBrand =
      before.includes("Savona Brand Title") || before.includes("BEAM logo visibility");
    const after = patchCss(before, plusUri);
    if (hasBrand && !(after.includes("Savona Brand Title") || after.includes("BEAM logo visibility"))) {
      throw new Error("Refusing to write CSS that lost brand rules: " + cssPath);
    }
    fs.writeFileSync(cssPath, after);
    console.log(
      "css",
      path.relative(ROOT, cssPath),
      "v3",
      after.includes("icons-newchat-v3"),
      "pngMask",
      after.includes("beam-icons/bold/plus.png")
    );
  }

  const htmlPaths = uniqExisting(FRONTENDS.map((d) => path.join(d, "index.html")));
  for (const htmlPath of htmlPaths) {
    const after = patchHtml(fs.readFileSync(htmlPath, "utf8"));
    fs.writeFileSync(htmlPath, after);
    console.log("html", path.relative(ROOT, htmlPath), CACHE_BUST, after.includes("beam-titlebar-newchat-v3"));
  }

  console.log("DONE", CACHE_BUST);
}

await main();
