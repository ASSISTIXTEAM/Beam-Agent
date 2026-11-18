/**
 * Full coolicons duocolor/round icon refresh across all Beam surfaces.
 * - Rasterize mask-safe PNGs (+ SVG wrappers) from coolicons duocolor/round
 * - Fix tagger so Settings "Limits" is tagged (without masking quota rings)
 * - Expand CSS for Settings / Profile / Models / chrome
 * - Sync assistix+dsh × runtime+dist+BeamAgent; cache-bust
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sharp = require(
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/sharp")
);

const CACHE_BUST = "coolicons-everywhere-v4";
const COOL = path.join(ROOT, "desktop/_coolicons_svg/package/duocolor/round");

const FRONTENDS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
];

/** role → coolicons basename (duocolor/round) */
const ROLE_ICONS = {
  plus: "plus",
  "plus-small": "plus",
  send: "paper-plane",
  "paper-plane": "paper-plane",
  "arrow-up": "arrow-up",
  attach: "paperclip",
  clip: "paperclip",
  paperclip: "paperclip",
  plugins: "grid",
  apps: "grid",
  "apps-add": "more-grid",
  more: "more-horizontal",
  automation: "clock",
  clock: "clock",
  search: "search",
  refresh: "reload",
  update: "reload",
  reload: "reload",
  logout: "log-out",
  login: "log-in",
  settings: "settings",
  general: "settings",
  "settings-sliders": "slider-2",
  sliders: "slider-2",
  "slider-2": "slider-2",
  user: "user",
  profile: "user",
  limits: "activity",
  activity: "activity",
  model: "cpu",
  chip: "cpu",
  cpu: "cpu",
  mic: "microphone",
  microphone: "microphone",
  archive: "archive",
  close: "close",
  copy: "copy",
  share: "share",
  "thumbs-up": "thumbs-up",
  "thumbs-down": "thumbs-down",
  bell: "bell",
  sun: "sun",
  moon: "moon",
  monitor: "desktop",
  desktop: "desktop",
  folder: "folder",
  "folder-plus": "folder-plus",
  workspace: "folder",
  "window-sidebar": "window-sidebar",
  expand: "expand",
  window: "window",
  terminal: "terminal",
  globe: "globe",
  compass: "compass",
  bulb: "bulb",
  sparkle: "sparkle",
  robot: "robot",
  brain: "brain",
  pencil: "pencil",
  trash: "trash",
  check: "check",
  "chevron-down": "chevron-down",
  "external-link": "external-link",
  shield: "shield",
  key: "key",
  code: "code",
  database: "database",
  "circle-info": "circle-info",
  "circle-help": "circle-help",
  hand: "hand",
  eye: "eye",
  "eye-off": "eye-off",
  chat: "chat",
  "chat-plus": "chat-plus",
  house: "house",
  power: "power",
  upload: "upload",
  download: "download",
  "file-text": "file-text",
  grid: "grid",
  "more-grid": "more-grid",
  "more-horizontal": "more-horizontal",
};

const GUIDE = {
  files: { cool: "folder", tint: "#F5A524" },
  terminal: { cool: "terminal", tint: "#3CC6C4" },
  browser: { cool: "globe", tint: "#679EFE" },
  hero: { cool: "compass", tint: "#6B7C7A" },
};

function uniqExisting(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const n = path.normalize(p);
    if (seen.has(n) || !fs.existsSync(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

async function rasterMask(coolName, outPng, size = 64) {
  const src = path.join(COOL, `${coolName}.svg`);
  if (!fs.existsSync(src)) return false;
  let svg = fs.readFileSync(src, "utf8");
  svg = svg
    .replace(/currentColor/gi, "#000000")
    .replace(/stroke="white"/gi, 'stroke="#000000"')
    .replace(/fill="white"/gi, 'fill="#000000"');
  if (!/viewBox=/.test(svg) && /width="24"/.test(svg)) {
    svg = svg.replace("<svg", '<svg viewBox="0 0 24 24"');
  }
  const buf = await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();
  fs.writeFileSync(outPng, buf);
  return true;
}

function writeSvgWrapper(pngPath, svgPath) {
  const b64 = fs.readFileSync(pngPath).toString("base64");
  fs.writeFileSync(
    svgPath,
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><image href="data:image/png;base64,${b64}" width="24" height="24" preserveAspectRatio="xMidYMid meet"/></svg>\n`
  );
}

async function ensureIconSet(iconDir) {
  const bold = path.join(iconDir, "bold");
  const fill = path.join(iconDir, "fill");
  fs.mkdirSync(bold, { recursive: true });
  fs.mkdirSync(fill, { recursive: true });
  let n = 0;
  const coolNames = new Set(Object.values(ROLE_ICONS));
  for (const cool of coolNames) {
    for (const dir of [bold, fill]) {
      const png = path.join(dir, `${cool}.png`);
      const svg = path.join(dir, `${cool}.svg`);
      if (!(await rasterMask(cool, png))) continue;
      writeSvgWrapper(png, svg);
      n++;
    }
  }
  // aliases as copies of cool PNG
  for (const [alias, cool] of Object.entries(ROLE_ICONS)) {
    if (alias === cool) continue;
    for (const dir of [bold, fill]) {
      const src = path.join(dir, `${cool}.png`);
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(dir, `${alias}.png`));
      writeSvgWrapper(src, path.join(dir, `${alias}.svg`));
      n++;
    }
  }
  // colored guide sprites
  const guideDir = path.join(iconDir, "guide");
  fs.mkdirSync(guideDir, { recursive: true });
  for (const [key, { cool, tint }] of Object.entries(GUIDE)) {
    const src = path.join(COOL, `${cool}.svg`);
    if (!fs.existsSync(src)) continue;
    let svg = fs.readFileSync(src, "utf8");
    svg = svg
      .replace(/stroke="currentColor"/g, `stroke="${tint}"`)
      .replace(/fill="currentColor"/g, `fill="${tint}"`);
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

const EXTRA_CSS = `
/* ===== BEAM coolicons-everywhere-v4 ===== */
/* Settings / Profile / Models — force coolicons masks; never touch quota rings */

/* Hard exempt: colorful stroke rings stay colorful strokes */
#beam-side-limits .bsl-rings,
#beam-side-limits .bsl-rings svg,
#beam-side-limits .bsl-rings .bsl-chart,
#beam-side-limits .bsl-rings .bsl-chart svg,
#beam-side-limits .bsl-ring svg,
#beam-limits-modal .blm-ring-wrap svg,
#beam-limits-modal .blm-ring-wrap .bsl-chart svg,
#beam-limits-panel .bsl-chart svg {
  -webkit-mask: none !important;
  mask: none !important;
  background: none !important;
  background-color: transparent !important;
}
#beam-side-limits .bsl-rings svg *,
#beam-side-limits .bsl-rings .bsl-chart svg *,
#beam-side-limits .bsl-ring svg *,
#beam-limits-modal .blm-ring-wrap svg *,
#beam-limits-modal .blm-ring-wrap .bsl-chart svg *,
#beam-limits-panel .bsl-chart svg * {
  opacity: 1 !important;
  fill: revert-layer !important;
  stroke: revert-layer !important;
}

/* Settings dialog / shell — sized icon hosts */
[role="dialog"] button[data-beam-icon] > svg,
[role="dialog"] [role="tab"][data-beam-icon] > svg,
[role="dialog"] [role="button"][data-beam-icon] > svg,
[class*="settings"] button[data-beam-icon] > svg,
[class*="Settings"] button[data-beam-icon] > svg,
[class*="settingsShell"] [data-beam-icon] > svg,
[class*="SettingsShell"] [data-beam-icon] > svg,
[class*="settingsNav"] [data-beam-icon] > svg,
[class*="model"] button[data-beam-icon] > svg,
[class*="Model"] button[data-beam-icon] > svg,
[class*="modelPicker"] [data-beam-icon] > svg,
[class*="ModelPicker"] [data-beam-icon] > svg,
#beam-profile-modal [data-beam-icon] > svg,
#beam-limits-modal [data-beam-icon] > svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  flex: none !important;
  background-color: currentColor !important;
  opacity: 1 !important;
  overflow: hidden !important;
  color: inherit !important;
}
[role="dialog"] button[data-beam-icon] > svg *,
[role="dialog"] [role="tab"][data-beam-icon] > svg *,
[class*="settings"] button[data-beam-icon] > svg *,
[class*="Settings"] button[data-beam-icon] > svg *,
[class*="modelPicker"] [data-beam-icon] > svg *,
#beam-profile-modal [data-beam-icon] > svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}

/* Role → coolicons PNG masks (settings/profile/models + global) */
[data-beam-icon="general"] svg { -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="settings"] svg { -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="user"] svg,
[data-beam-icon="profile"] svg { -webkit-mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="limits"]:not(.bsl-rings) svg { -webkit-mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="model"] svg,
[data-beam-icon="chip"] svg { -webkit-mask: url("./beam-icons/bold/cpu.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/cpu.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="sliders"] svg,
[data-beam-icon="settings-sliders"] svg { -webkit-mask: url("./beam-icons/bold/slider-2.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/slider-2.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="mic"] svg,
[data-beam-icon="microphone"] svg { -webkit-mask: url("./beam-icons/bold/microphone.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/microphone.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="archive"] svg { -webkit-mask: url("./beam-icons/bold/archive.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/archive.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="sun"] svg { -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="moon"] svg { -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="monitor"] svg { -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="search"] svg { -webkit-mask: url("./beam-icons/bold/search.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/search.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="close"] svg { -webkit-mask: url("./beam-icons/bold/close.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/close.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="automation"] svg { -webkit-mask: url("./beam-icons/bold/clock.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/clock.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="shield"] svg { -webkit-mask: url("./beam-icons/bold/shield.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/shield.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="key"] svg { -webkit-mask: url("./beam-icons/bold/key.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/key.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="code"] svg { -webkit-mask: url("./beam-icons/bold/code.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/code.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="database"] svg { -webkit-mask: url("./beam-icons/bold/database.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/database.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="bell"] svg { -webkit-mask: url("./beam-icons/bold/bell.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/bell.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="logout"] svg { -webkit-mask: url("./beam-icons/bold/log-out.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/log-out.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="login"] svg { -webkit-mask: url("./beam-icons/bold/log-in.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/log-in.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="pencil"] svg,
[data-beam-icon="edit"] svg { -webkit-mask: url("./beam-icons/bold/pencil.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/pencil.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="trash"] svg { -webkit-mask: url("./beam-icons/bold/trash.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/trash.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="copy"] svg { -webkit-mask: url("./beam-icons/bold/copy.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/copy.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="share"] svg { -webkit-mask: url("./beam-icons/bold/share.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/share.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="chevron-down"] svg { -webkit-mask: url("./beam-icons/bold/chevron-down.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/chevron-down.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="external-link"] svg { -webkit-mask: url("./beam-icons/bold/external-link.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/external-link.png") center / contain no-repeat !important; background-color: currentColor !important; }
[data-beam-icon="refresh"] svg { -webkit-mask: url("./beam-icons/bold/reload.png") center / contain no-repeat !important; mask: url("./beam-icons/bold/reload.png") center / contain no-repeat !important; background-color: currentColor !important; }

[data-beam-icon="general"] svg *,
[data-beam-icon="settings"] svg *,
[data-beam-icon="user"] svg *,
[data-beam-icon="profile"] svg *,
[data-beam-icon="limits"]:not(.bsl-rings) svg *,
[data-beam-icon="model"] svg *,
[data-beam-icon="chip"] svg *,
[data-beam-icon="sliders"] svg *,
[data-beam-icon="settings-sliders"] svg *,
[data-beam-icon="mic"] svg *,
[data-beam-icon="microphone"] svg *,
[data-beam-icon="archive"] svg *,
[data-beam-icon="sun"] svg *,
[data-beam-icon="moon"] svg *,
[data-beam-icon="monitor"] svg *,
[data-beam-icon="search"] svg *,
[data-beam-icon="close"] svg *,
[data-beam-icon="automation"] svg *,
[data-beam-icon="shield"] svg *,
[data-beam-icon="key"] svg *,
[data-beam-icon="code"] svg *,
[data-beam-icon="database"] svg *,
[data-beam-icon="bell"] svg *,
[data-beam-icon="logout"] svg *,
[data-beam-icon="login"] svg *,
[data-beam-icon="pencil"] svg *,
[data-beam-icon="edit"] svg *,
[data-beam-icon="trash"] svg *,
[data-beam-icon="copy"] svg *,
[data-beam-icon="share"] svg *,
[data-beam-icon="chevron-down"] svg *,
[data-beam-icon="external-link"] svg *,
[data-beam-icon="refresh"] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}

/* Text/aria fallbacks for Settings nav when tagger lags (exclude rings) */
[role="dialog"] button:not(.bsl-rings):has(svg):is([aria-label*="General" i], [aria-label*="Общие" i]) svg,
[class*="settings"] button:not(.bsl-rings):has(svg):is([aria-label*="General" i], [aria-label*="Общие" i]) svg {
  -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button:not(.bsl-rings):has(svg):is([aria-label*="Profile" i], [aria-label*="Профиль" i], [aria-label*="Account" i]) svg,
[class*="settings"] button:not(.bsl-rings):has(svg):is([aria-label*="Profile" i], [aria-label*="Профиль" i]) svg {
  -webkit-mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button:not(.bsl-rings):has(svg):is([aria-label*="Limits" i], [aria-label*="Лимит" i]) svg,
[class*="settings"] button:not(.bsl-rings):has(svg):is([aria-label*="Limits" i], [aria-label*="Лимит" i]) svg {
  -webkit-mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button:not(.bsl-rings):has(svg):is([aria-label*="Model" i], [aria-label*="Модел" i]) svg,
[class*="settings"] button:not(.bsl-rings):has(svg):is([aria-label*="Model" i], [aria-label*="Модел" i]) svg,
[class*="modelPicker"] [data-beam-icon="model"] svg,
[class*="ModelPicker"] [data-beam-icon="model"] svg,
button[data-beam-icon="model"] svg {
  -webkit-mask: url("./beam-icons/bold/cpu.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/cpu.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}

/* Profile modal close + action icons */
#beam-profile-modal .bpm-close,
#beam-limits-modal .bpm-close {
  position: relative !important;
}
#beam-profile-modal .bpm-close:has(svg) svg,
#beam-limits-modal .bpm-close:has(svg) svg {
  -webkit-mask: url("./beam-icons/bold/close.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/close.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
#beam-profile-modal .bpm-close:has(svg) svg *,
#beam-limits-modal .bpm-close:has(svg) svg * {
  opacity: 0 !important; fill: transparent !important; stroke: transparent !important;
}

/* Sidebar gear already masked; ensure PNG */
#beam-side-limits .bsl-gear .bsl-gear-ico {
  -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}

/* Model picker / composer model chip chevron */
[class*="model"] [class*="chevron"] svg,
[class*="Model"] [class*="chevron"] svg,
button[aria-label*="model" i] [class*="chevron"] svg,
[data-beam-icon="chevron-down"] svg {
  -webkit-mask: url("./beam-icons/bold/chevron-down.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/chevron-down.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
`;

function patchCss(css) {
  let s = css;
  // Retarget any leftover .svg mask urls under bold/fill to .png
  s = s.replace(
    /(url\("\.\/beam-icons\/(?:bold|fill)\/[a-z0-9-]+)\.svg("\))/g,
    "$1.png$2"
  );
  // Drop prior v4 block to avoid stacking
  s = s.replace(
    /\n?\/\* ===== BEAM coolicons-everywhere-v4 ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g,
    "\n"
  );
  return s.trimEnd() + "\n" + EXTRA_CSS + "\n";
}

function patchHtml(html) {
  let h = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE_BUST}"`
  );

  // Fix gauge skip: only skip ring hosts, never Settings nav Limits
  if (!h.includes("/* beam-skip-gauge-v4 */")) {
    h = h.replace(
      /\/\* __beamSkipGaugeTag \*\/\s*if \(\/tide\|flare\|pine\|лимит\|limits\/i\.test\(labelOf\(el\)\)\) continue;/,
      `/* beam-skip-gauge-v4 */
      /* __beamSkipGaugeTag */
      if (el.classList?.contains("bsl-rings") || el.closest?.(".bsl-rings,.bsl-chart,.blm-ring-wrap,#beam-limits-panel,#beam-side-limits")) continue;
      if (el.querySelector?.(".bsl-chart,.bsl-ring") && /tide|flare|pine|лимит|limits/i.test(labelOf(el))) continue;`
    );
  }

  // Expand node list to include tabs (settings nav)
  if (!h.includes("/* beam-tag-nodes-v4 */")) {
    h = h.replace(
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelGlyph'], [class*='iconButton']");`,
      `/* beam-tag-nodes-v4 */
    const nodes = document.querySelectorAll("button, [role='button'], [role='tab'], [class*='panelGlyph'], [class*='iconButton'], [class*='settingsNav'] *, [class*='SettingsNav'] *");`
    );
  }

  // Stronger settings/profile/models rules (insert after nav-rules marker)
  if (!h.includes("/* beam-icon-rules-v4 */")) {
    const inject = `/* beam-icon-rules-v4 */
      [/^\\s*general\\s*$|^\\s*общие\\s*$/i, "general"],
      [/^\\s*profile\\s*$|^\\s*профиль\\s*$|^\\s*account\\s*$|^\\s*аккаунт\\s*$/i, "user"],
      [/^\\s*limits\\s*$|^\\s*лимиты\\s*$|^\\s*лимит\\s*$/i, "limits"],
      [/^\\s*models?\\s*$|^\\s*модели\\s*$|^\\s*модель\\s*$/i, "model"],
      [/^\\s*appearance\\s*$|^\\s*оформление\\s*$|^\\s*тема\\s*$/i, "sliders"],
      [/^\\s*light\\s*$|светл/i, "sun"],
      [/^\\s*dark\\s*$|т[её]мн/i, "moon"],
      [/^\\s*system\\s*$|системн/i, "monitor"],
      [/персонал|personalization|агент.?preset|agent preset|preset/i, "sliders"],
      [/модел|model|llm|model picker|выбор модел/i, "model"],
      [/микрофон|microphone|voice|голос/i, "mic"],
      [/архив|archive|данн|data|storage|хранен/i, "archive"],
      [/безопас|security|privacy|приват|shield/i, "shield"],
      [/ключ|api key|токен|token|credential/i, "key"],
      [/уведом|notification|bell/i, "bell"],
      [/терминал|terminal|shell/i, "code"],
      [/база|database|sqlite/i, "database"],
`;
    if (h.includes("/* beam-settings-nav-rules-v3b */")) {
      h = h.replace("/* beam-settings-nav-rules-v3b */", `/* beam-settings-nav-rules-v3b */\n${inject}`);
    } else if (h.includes("/* beam-settings-icon-rules-v3 */")) {
      h = h.replace("/* beam-settings-icon-rules-v3 */", `/* beam-settings-icon-rules-v3 */\n${inject}`);
    } else {
      // Fallback: inject before first settings rule
      h = h.replace(
        `[/настрой|settings|preferences|параметр/i, "settings"],`,
        `${inject}      [/настрой|settings|preferences|параметр/i, "settings"],`
      );
    }
  }

  // Soften model rule that matched tide/flare/pine (quota labels)
  h = h.replace(
    `[/модел|model|llm|tide|flare|pine/i, "model"],`,
    `[/модел|model|llm|model picker|выбор модел/i, "model"],`
  );

  // Dedicated settings-dialog tagger pass
  if (!h.includes("/* beam-settings-dialog-tagger-v4 */")) {
    const dialogTagger = `
/* beam-settings-dialog-tagger-v4 */
try {
  const settingsRoot = document.querySelector('[class*="settingsShell"], [class*="SettingsShell"], [class*="settings"][role="dialog"], [role="dialog"][class*="Settings"], [class*="settingsNav"], [class*="SettingsNav"]');
  const scope = settingsRoot || document;
  const map = [
    [/^\\s*(general|общие)\\s*$/i, "general"],
    [/^\\s*(profile|профиль|account|аккаунт)\\s*$/i, "user"],
    [/^\\s*(limits|лимиты|лимит)\\s*$/i, "limits"],
    [/^\\s*(models?|модели|модель)\\s*$/i, "model"],
    [/^\\s*(appearance|оформление|тема)\\s*$/i, "sliders"],
    [/^\\s*(light|светл)/i, "sun"],
    [/^\\s*(dark|т[её]мн)/i, "moon"],
    [/^\\s*(system|системн)/i, "monitor"],
    [/personalization|персонал|preset|пресет/i, "sliders"],
    [/microphone|микрофон|voice|голос/i, "mic"],
    [/archive|архив|data|данн|storage/i, "archive"],
    [/settings|настрой|preferences/i, "settings"],
  ];
  for (const el of scope.querySelectorAll("button, [role='button'], [role='tab']")) {
    if (el.closest("#beam-side-limits,.bsl-rings,.bsl-chart,.blm-ring-wrap")) continue;
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
    if (!label || label.length > 48) continue;
    for (const [re, role] of map) {
      if (re.test(label)) {
        el.setAttribute("data-beam-icon", role);
        break;
      }
    }
  }
  // Model picker surfaces
  for (const el of document.querySelectorAll('[class*="modelPicker"] button, [class*="ModelPicker"] button, [class*="modelSelect"] button, [aria-label*="model" i], [aria-label*="модел" i]')) {
    if (el.closest("#beam-side-limits,.bsl-rings")) continue;
    if (!el.getAttribute("data-beam-icon")) el.setAttribute("data-beam-icon", "model");
  }
} catch {}
`;
    // Inject at start of beamTagIcons body after strip
    if (h.includes("beamStripNewSessionIconHosts();")) {
      h = h.replace(
        "beamStripNewSessionIconHosts();",
        `beamStripNewSessionIconHosts();\n${dialogTagger}`
      );
      // Only first occurrence — good enough (tagger entry)
      // Prevent double-inject on re-run via marker already present
    }
  }

  return h;
}

async function main() {
  if (!fs.existsSync(COOL)) {
    console.error("Missing coolicons duocolor/round at", COOL);
    process.exit(1);
  }
  const fronts = uniqExisting(FRONTENDS);
  console.log("frontends", fronts.length);

  for (const dist of fronts) {
    const iconDir = path.join(dist, "assets/beam-icons");
    const n = await ensureIconSet(iconDir);
    console.log("icons", path.relative(ROOT, iconDir) || iconDir, n);

    const cssPath = path.join(dist, "assets/beam-override.css");
    const before = fs.readFileSync(cssPath, "utf8");
    const hasBrand =
      before.includes("Savona Brand Title") || before.includes("BEAM logo visibility");
    const after = patchCss(before);
    if (hasBrand && !(after.includes("Savona Brand Title") || after.includes("BEAM logo visibility"))) {
      throw new Error("Refusing to write CSS that lost brand rules: " + cssPath);
    }
    // Safety: ring exempt must remain
    if (!after.includes("bsl-rings") || !after.includes("coolicons-everywhere-v4")) {
      throw new Error("Missing ring protect / v4 block: " + cssPath);
    }
    fs.writeFileSync(cssPath, after);
    console.log("css", path.relative(ROOT, cssPath) || cssPath, "png", after.includes("beam-icons/bold/settings.png"));

    const htmlPath = path.join(dist, "index.html");
    const htmlAfter = patchHtml(fs.readFileSync(htmlPath, "utf8"));
    fs.writeFileSync(htmlPath, htmlAfter);
    console.log(
      "html",
      path.relative(ROOT, htmlPath) || htmlPath,
      CACHE_BUST,
      "skipV4",
      htmlAfter.includes("beam-skip-gauge-v4"),
      "rulesV4",
      htmlAfter.includes("beam-icon-rules-v4")
    );
  }

  console.log("DONE", CACHE_BUST);
}

await main();
