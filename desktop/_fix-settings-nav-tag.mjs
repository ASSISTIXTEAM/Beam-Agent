/**
 * Fix Settings nav (AnXs9G_navCell) + appearance theme icons:
 * - CSS class-based masks (no dependency on tagger timing)
 * - Hardened tagger that targets navCell / theme buttons
 * - Keep quota rings exempt
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = "coolicons-everywhere-v4b";

const FRONTENDS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
];

const EXTRA_CSS = `
/* ===== BEAM settings-navCell coolicons v4b ===== */
/* Settings shell nav cells: class AnXs9G_navCell — mask by label via attribute OR structure */
button[class*="navCell"][data-beam-icon] > svg,
button[class*="NavCell"][data-beam-icon] > svg,
[class*="navCell"][data-beam-icon] svg,
[class*="settings"] [class*="navList"] button svg,
[class*="Settings"] [class*="navList"] button svg,
[role="dialog"] [class*="navList"] button svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  flex: none !important;
  background-color: currentColor !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
button[class*="navCell"][data-beam-icon] > svg *,
[class*="navList"] button[data-beam-icon] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}

/* Direct label-driven masks on settings nav cells (works even before tagger) */
[role="dialog"] [class*="navList"] button:nth-child(1) svg,
[class*="navList"] button[data-beam-icon="general"] svg {
  -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="navList"] button:nth-child(2) svg,
[class*="navList"] button[data-beam-icon="user"] svg,
[class*="navList"] button[data-beam-icon="profile"] svg {
  -webkit-mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/user.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="navList"] button:nth-child(3) svg,
[class*="navList"] button[data-beam-icon="limits"]:not(.bsl-rings) svg {
  -webkit-mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="navList"] button:nth-child(4) svg,
[class*="navList"] button[data-beam-icon="about"] svg,
[class*="navList"] button[data-beam-icon="info"] svg {
  -webkit-mask: url("./beam-icons/bold/circle-info.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/circle-info.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="navList"] button:nth-child(1) svg *,
[role="dialog"] [class*="navList"] button:nth-child(2) svg *,
[role="dialog"] [class*="navList"] button:nth-child(3) svg *,
[role="dialog"] [class*="navList"] button:nth-child(4) svg *,
[class*="navList"] button[data-beam-icon] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}

/* Appearance theme chips: Light / Dark / System */
button[data-beam-icon="sun"] svg,
[role="dialog"] button:has([class*="navLabel"]):not([class*="navCell"]) svg { /* noop guard */ }
/* Theme row buttons by data attr after tagger; also by exact text via :has(span) */
[role="dialog"] button[data-beam-icon="sun"] svg,
[role="dialog"] [class*="theme"] button:nth-child(1) svg,
[role="dialog"] [class*="Theme"] button:nth-child(1) svg,
[role="dialog"] [class*="appearance"] button:nth-child(1) svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button[data-beam-icon="moon"] svg,
[role="dialog"] [class*="theme"] button:nth-child(2) svg,
[role="dialog"] [class*="Theme"] button:nth-child(2) svg,
[role="dialog"] [class*="appearance"] button:nth-child(2) svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button[data-beam-icon="monitor"] svg,
[role="dialog"] [class*="theme"] button:nth-child(3) svg,
[role="dialog"] [class*="Theme"] button:nth-child(3) svg,
[role="dialog"] [class*="appearance"] button:nth-child(3) svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button[data-beam-icon="sun"] svg *,
[role="dialog"] button[data-beam-icon="moon"] svg *,
[role="dialog"] button[data-beam-icon="monitor"] svg *,
[role="dialog"] [class*="theme"] button svg *,
[role="dialog"] [class*="Theme"] button svg *,
[role="dialog"] [class*="appearance"] button svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}

/* Re-assert ring exempt after any broad dialog svg rules */
#beam-side-limits .bsl-rings svg,
#beam-side-limits .bsl-rings .bsl-chart svg,
#beam-limits-modal .blm-ring-wrap svg,
#beam-limits-modal .blm-ring-wrap .bsl-chart svg {
  -webkit-mask: none !important;
  mask: none !important;
  background: none !important;
  background-color: transparent !important;
}
#beam-side-limits .bsl-rings svg *,
#beam-side-limits .bsl-rings .bsl-chart svg *,
#beam-limits-modal .blm-ring-wrap svg *,
#beam-limits-modal .blm-ring-wrap .bsl-chart svg * {
  opacity: 1 !important;
  fill: revert-layer !important;
  stroke: revert-layer !important;
}
`;

const TAGGER_SNIPPET = `
/* beam-navcell-tagger-v4b */
try {
  const navBtns = document.querySelectorAll('[class*="navList"] button, button[class*="navCell"], button[class*="NavCell"]');
  for (const el of navBtns) {
    if (el.closest("#beam-side-limits,.bsl-rings")) continue;
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
    if (/^(general|общие|settings|настройки)$/i.test(label)) el.setAttribute("data-beam-icon", "general");
    else if (/^(profile|профиль|account|аккаунт)$/i.test(label)) el.setAttribute("data-beam-icon", "user");
    else if (/^(limits|лимиты|лимит)$/i.test(label)) el.setAttribute("data-beam-icon", "limits");
    else if (/^(about|о приложении)$/i.test(label)) el.setAttribute("data-beam-icon", "about");
    else if (/^(models?|модели|модель)$/i.test(label)) el.setAttribute("data-beam-icon", "model");
  }
  for (const el of document.querySelectorAll('[role="dialog"] button, [class*="settings"] button, [class*="Settings"] button')) {
    if (el.closest("#beam-side-limits,.bsl-rings,.bsl-chart")) continue;
    if (el.matches('[class*="navCell"], [class*="NavCell"]')) continue;
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
    if (/^(light|светл)/i.test(label)) el.setAttribute("data-beam-icon", "sun");
    else if (/^(dark|т[её]мн)/i.test(label)) el.setAttribute("data-beam-icon", "moon");
    else if (/^(system|систем)/i.test(label)) el.setAttribute("data-beam-icon", "monitor");
  }
} catch {}
`;

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

for (const dist of uniqExisting(FRONTENDS)) {
  const cssPath = path.join(dist, "assets/beam-override.css");
  let css = fs.readFileSync(cssPath, "utf8");
  css = css.replace(
    /\n?\/\* ===== BEAM settings-navCell coolicons v4b ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g,
    "\n"
  );
  css = css.trimEnd() + "\n" + EXTRA_CSS + "\n";
  fs.writeFileSync(cssPath, css);

  const htmlPath = path.join(dist, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE}"`
  );

  // Relax multi-svg skip for settings nav cells
  if (!html.includes("/* beam-navcell-multisvg-v4b */")) {
    html = html.replace(
      `if ((el.querySelectorAll("svg") || []).length >= 2) continue;`,
      `/* beam-navcell-multisvg-v4b */
      if ((el.querySelectorAll("svg") || []).length >= 2 && !el.matches('[class*="navCell"], [class*="NavCell"]') && !el.closest('[class*="navList"]')) continue;`
    );
  }

  if (!html.includes("/* beam-navcell-tagger-v4b */")) {
    // Inject at start of beamTagIcons after strip
    if (html.includes("beamStripNewSessionIconHosts();")) {
      html = html.replace(
        "beamStripNewSessionIconHosts();",
        `beamStripNewSessionIconHosts();\n${TAGGER_SNIPPET}`
      );
    }
  }

  fs.writeFileSync(htmlPath, html);
  console.log(
    "ok",
    path.relative(ROOT, dist) || dist,
    "navCSS",
    css.includes("settings-navCell coolicons v4b"),
    "tagger",
    html.includes("beam-navcell-tagger-v4b"),
    CACHE
  );
}

console.log("DONE", CACHE);
