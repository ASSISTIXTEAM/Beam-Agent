/**
 * Additive: tag Settings nav rows (General/Profile/Limits/…) + appearance glyphs.
 * Does not regenerate PNGs; only patches HTML tagger + appends CSS if missing.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = "icons-newchat-v3b";

const FRONTENDS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

const EXTRA_CSS = `
/* ===== BEAM settings-nav icons v3b ===== */
/* Settings shell nav / section headers — coolicons via label heuristics */
[role="dialog"] button[data-beam-icon] svg,
[class*="settings"] button[data-beam-icon] svg,
[class*="Settings"] button[data-beam-icon] svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  background-color: currentColor !important;
  opacity: 1 !important;
  overflow: hidden !important;
}
[role="dialog"] button[data-beam-icon] svg *,
[class*="settings"] button[data-beam-icon] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
button[data-beam-icon="general"] svg,
button[aria-label*="General" i] svg,
button[aria-label*="Общие" i] svg {
  -webkit-mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/settings.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
button[data-beam-icon="limits"]:not(.bsl-rings) svg,
button[aria-label*="Limits" i]:not(.bsl-rings) svg,
button[aria-label*="Лимит" i]:not(.bsl-rings) svg {
  -webkit-mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/activity.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
button[data-beam-icon="sun"] svg,
button[aria-label*="Light" i] svg,
button[aria-label="Light"] svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
button[data-beam-icon="moon"] svg,
button[aria-label*="Dark" i] svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
button[data-beam-icon="monitor"] svg,
button[aria-label*="System" i] svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
button[data-beam-icon="general"] svg *,
button[data-beam-icon="limits"]:not(.bsl-rings) svg *,
button[data-beam-icon="sun"] svg *,
button[data-beam-icon="moon"] svg *,
button[data-beam-icon="monitor"] svg *,
button[aria-label*="General" i] svg *,
button[aria-label*="Limits" i]:not(.bsl-rings) svg *,
button[aria-label*="Light" i] svg *,
button[aria-label*="Dark" i] svg *,
button[aria-label*="System" i] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
`;

function ensureCoolPng(iconDir, name) {
  const cool = path.join(ROOT, "desktop/_coolicons_svg/package/duocolor/round", `${name}.svg`);
  const out = path.join(iconDir, "bold", `${name}.png`);
  if (fs.existsSync(out) || !fs.existsSync(cool)) return;
  // Lazy: copy wrapper extraction not needed — leave for runtime if missing; CSS will no-op
}

for (const dist of FRONTENDS) {
  const cssPath = path.join(dist, "assets/beam-override.css");
  const htmlPath = path.join(dist, "index.html");
  if (!fs.existsSync(cssPath)) continue;
  let css = fs.readFileSync(cssPath, "utf8");
  if (!css.includes("settings-nav icons v3b")) {
    css = css.trimEnd() + "\n" + EXTRA_CSS + "\n";
    fs.writeFileSync(cssPath, css);
    console.log("css+", path.relative(ROOT, cssPath));
  }
  // ensure activity/sun/moon/desktop pngs exist via copy from already-generated if named differently
  const bold = path.join(dist, "assets/beam-icons/bold");
  const aliases = {
    activity: ["activity", "chart-bar"],
    sun: ["sun"],
    moon: ["moon"],
    desktop: ["desktop", "monitor", "window"],
  };
  for (const [want, alts] of Object.entries(aliases)) {
    const dest = path.join(bold, `${want}.png`);
    if (fs.existsSync(dest)) continue;
    for (const a of alts) {
      const src = path.join(bold, `${a}.png`);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log("alias", want, "<-", a);
        break;
      }
    }
  }

  if (!fs.existsSync(htmlPath)) continue;
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE}"`
  );
  if (!html.includes("beam-settings-nav-rules-v3b")) {
    html = html.replace(
      `/* beam-settings-icon-rules-v3 */`,
      `/* beam-settings-icon-rules-v3 */
      /* beam-settings-nav-rules-v3b */
      [/^\\s*general\\s*$|общие/i, "general"],
      [/^\\s*profile\\s*$|^\\s*профиль\\s*$/i, "user"],
      [/^\\s*limits\\s*$|лимит/i, "limits"],
      [/^\\s*light\\s*$|светл/i, "sun"],
      [/^\\s*dark\\s*$|т[её]мн/i, "moon"],
      [/^\\s*system\\s*$|системн/i, "monitor"],`
    );
  }
  fs.writeFileSync(htmlPath, html);
  console.log("html", path.relative(ROOT, htmlPath), CACHE);
}

console.log("DONE", CACHE);
