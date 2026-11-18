/**
 * Make coolicons VISIBLE in Beam: replace Flaticon beam-icons masks with
 * @coolicons/svg duocolor+round (idle) and fill+round (active).
 * Also re-applies sprite replacements from patch-coolicons.mjs.
 *
 * Docs: https://coolicons.cool/ — path @coolicons/svg/<style>/<radius>/<name>.svg
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = path.join(ROOT, "desktop/vendor/coolicons/icons/svg");
const DUOCOLOR = path.join(VENDOR, "duocolor/round");
const FILL = path.join(VENDOR, "fill/round");
const LINE = path.join(VENDOR, "line/round");
const DUOTONE = path.join(VENDOR, "duotone/round");

/** Role used by data-beam-icon → coolicon basename */
const ICON_MAP = {
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
  bulb: "lightbulb",
  rocket: "rocket",
  magic: "sparkle",
  interactive: "hand",
  list: "list-unordered",
  dashboard: "layout-dashboard",
  recycle: "recycle",
  power: "power",
  "data-transfer": "arrow-left-right",
  "cloud-upload": "cloud-upload",
  // extras used by hard CSS
  microphone: "microphone",
  panel: "panel-left",
  "new-chat": "chat-plus",
};

function pickSvg(name, preferFill) {
  const candidates = preferFill
    ? [
        path.join(FILL, `${name}.svg`),
        path.join(DUOTONE, `${name}.svg`),
        path.join(DUOCOLOR, `${name}.svg`),
        path.join(LINE, `${name}.svg`),
      ]
    : [
        path.join(DUOCOLOR, `${name}.svg`),
        path.join(LINE, `${name}.svg`),
        path.join(DUOTONE, `${name}.svg`),
        path.join(FILL, `${name}.svg`),
      ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return null;
}

function prepareForMask(svg) {
  // Masks need opaque shape; keep currentColor strokes/fills, drop fixed size
  let s = String(svg);
  s = s.replace(/\s(width|height)="[^"]*"/g, "");
  if (!/viewBox=/.test(s)) s = s.replace("<svg", '<svg viewBox="0 0 24 24"');
  // Ensure painted pixels for mask alpha: stroke/fill currentColor OK
  return s;
}

function copyInto(assetsDir) {
  const boldDir = path.join(assetsDir, "beam-icons", "bold");
  const fillDir = path.join(assetsDir, "beam-icons", "fill");
  fs.mkdirSync(boldDir, { recursive: true });
  fs.mkdirSync(fillDir, { recursive: true });
  const names = [...new Set(Object.values(ICON_MAP))];
  const missing = [];
  let n = 0;
  for (const name of names) {
    const boldSrc = pickSvg(name, false);
    const fillSrc = pickSvg(name, true);
    if (!boldSrc) {
      missing.push(name);
      continue;
    }
    // Always write under the mapped filename used by CSS
    fs.writeFileSync(path.join(boldDir, `${name}.svg`), prepareForMask(fs.readFileSync(boldSrc, "utf8")));
    fs.writeFileSync(
      path.join(fillDir, `${name}.svg`),
      prepareForMask(fs.readFileSync(fillSrc || boldSrc, "utf8"))
    );
    n++;
  }
  // Alias files expected by hard-wired CSS (plus.svg etc.) — already in map
  // Also alias legacy flaticon filenames referenced in CSS if any
  const aliases = {
    "plus-small": "plus",
    clip: "paperclip",
    "menu-dots": "more-horizontal",
    "sign-out": "log-out",
    "sign-in": "log-in",
    "magic-wand": "sparkle",
    "paper-plane": "paper-plane",
  };
  for (const [alias, target] of Object.entries(aliases)) {
    for (const dir of [boldDir, fillDir]) {
      const src = path.join(dir, `${target}.svg`);
      const dest = path.join(dir, `${alias}.svg`);
      if (fs.existsSync(src) && !fs.existsSync(dest)) fs.copyFileSync(src, dest);
    }
  }
  fs.writeFileSync(
    path.join(assetsDir, "beam-icons", "map.json"),
    JSON.stringify({ map: ICON_MAP, missing, source: "coolicons duocolor/fill round" }, null, 2)
  );
  return { n, missing };
}

function rewriteCssMasks(cssPath) {
  if (!fs.existsSync(cssPath)) return false;
  let css = fs.readFileSync(cssPath, "utf8");
  // Point hard-wired plus → still plus; clip → paperclip; menu-dots → more-horizontal; refresh→reload
  css = css.replace(/beam-icons\/(bold|fill)\/clip\.svg/g, "beam-icons/$1/paperclip.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/menu-dots\.svg/g, "beam-icons/$1/more-horizontal.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/refresh\.svg/g, "beam-icons/$1/reload.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/sign-out\.svg/g, "beam-icons/$1/log-out.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/sign-in\.svg/g, "beam-icons/$1/log-in.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/apps(?:-add)?\.svg/g, "beam-icons/$1/grid.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/edit\.svg/g, "beam-icons/$1/pencil.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/cross(?:-small)?\.svg/g, "beam-icons/$1/close.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/angle-/g, "beam-icons/$1/chevron-");
  css = css.replace(/beam-icons\/(bold|fill)\/comment\.svg/g, "beam-icons/$1/chat.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/home\.svg/g, "beam-icons/$1/house.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/bulb\.svg/g, "beam-icons/$1/lightbulb.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/magic-wand\.svg/g, "beam-icons/$1/sparkle.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/document\.svg/g, "beam-icons/$1/file-text.svg");
  css = css.replace(/beam-icons\/(bold|fill)\/list\.svg/g, "beam-icons/$1/list-unordered.svg");
  // Bust marker
  if (!css.includes("BEAM coolicons masks")) {
    css = css.replace(
      "/* ===== BEAM custom icons (flaticon bold/fill → currentColor masks) ===== */",
      "/* ===== BEAM custom icons (coolicons duocolor/fill round → currentColor masks) ===== */\n/* BEAM coolicons masks */"
    );
  }
  fs.writeFileSync(cssPath, css);
  return true;
}

function bumpHtml(htmlPath) {
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=cool2"'
  );
  // Force coolicons sprite script version bump
  html = html.replace(/__beamCooliconsV1/g, "__beamCooliconsV2");
  fs.writeFileSync(htmlPath, html);
  return true;
}

const ASSET_DIRS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets"),
];

let total = 0;
for (const assets of ASSET_DIRS) {
  if (!fs.existsSync(path.dirname(assets))) continue;
  const { n, missing } = copyInto(assets);
  rewriteCssMasks(path.join(assets, "beam-override.css"));
  bumpHtml(path.join(path.dirname(assets), "index.html"));
  console.log(path.relative(ROOT, assets), { copied: n, missing });
  total += n;
}

// Refresh sprite inject too
spawnSync(process.execPath, [path.join(ROOT, "desktop/patch-coolicons.mjs")], {
  stdio: "inherit",
});

console.log("coolicons masks applied, trees=", total);
if (!fs.existsSync(path.join(DUOCOLOR, "plus.svg"))) {
  console.error("Vendor coolicons missing — run sparse clone first");
  process.exit(1);
}
