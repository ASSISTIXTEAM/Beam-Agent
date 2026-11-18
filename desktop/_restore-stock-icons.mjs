/**
 * Restore stock app SVG visibility after icon experiments.
 * - Un-hide glyphs that still have fill/stroke:transparent from mask era
 * - Neutralize leftover data-beam-icon mask/first-of-type rules
 * - Disable beamTagIcons() so nothing re-tags for dead mask CSS
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WEBS = [
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
];

function fixCss(css) {
  let s = css;

  // Critical: New Session (and any leftover) invisible paths
  s = s.replace(
    /button\.wtg9ga_newSession svg \*,\s*button\[class\*="newSession"\] svg \* \{[^}]*\}/g,
    `button.wtg9ga_newSession svg *,
button[class*="newSession"] svg * {
  opacity: 1 !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}`
  );

  // Generic restore for any remaining transparent glyph killers EXCEPT fish logo hide
  s = s.replace(
    /(?<!fish[^\n]{0,80})(svg \* \{[^}]*)fill:\s*transparent\s*!important;([^}]*)stroke:\s*transparent\s*!important;/g,
    "$1/* stock fill */ fill: currentColor !important;$2/* stock stroke */ stroke: currentColor !important;"
  );

  // More targeted: newSession already done; also Send/Settings era leftovers as empty comment blocks stay

  // Remove "only first svg gets mask" leftovers that can blank chevrons / second glyphs
  s = s.replace(
    /\/\* Only the FIRST glyph under other tagged controls[\s\S]*?background:\s*none\s*!important;\s*\}/g,
    "/* reverted: first-of-type mask carve-out */"
  );

  // Ensure chrome buttons show stock SVG paint
  if (!s.includes("BEAM stock icon visibility")) {
    s += `

/* ===== BEAM stock icon visibility ===== */
button svg,
[role="button"] svg,
[class*="panelIcon"] svg,
[class*="panelGlyph"] svg,
[class*="iconButton"] svg,
.wtg9ga_newSession svg,
[data-beam-icon] svg {
  -webkit-mask: none !important;
  mask: none !important;
  background: none !important;
  background-color: transparent !important;
  opacity: 1 !important;
  color: inherit !important;
  overflow: visible !important;
}
button svg *:not(defs):not(clipPath):not(mask),
[role="button"] svg *:not(defs):not(clipPath):not(mask),
[class*="panelIcon"] svg *:not(defs):not(clipPath):not(mask),
[class*="panelGlyph"] svg *:not(defs):not(clipPath):not(mask),
[class*="iconButton"] svg *:not(defs):not(clipPath):not(mask),
.wtg9ga_newSession svg *:not(defs):not(clipPath):not(mask),
[data-beam-icon] svg *:not(defs):not(clipPath):not(mask) {
  opacity: 1 !important;
}
/* Do not force fill/stroke on usage rings — they use their own paints */
button[aria-label*="Tide"] svg,
button[aria-label*="Flare"] svg,
button[aria-label*="Pine"] svg,
button[aria-label*="Limits"] svg,
#beam-side-limits .bsl-chart svg {
  -webkit-mask: none !important;
  mask: none !important;
  background: none !important;
}
`;
  }

  return s;
}

function fixHtml(html) {
  let h = html;
  // Kill coolicons if any remnant
  h = h.replace(/<script id="beam-coolicons-force">[\s\S]*?<\/script>\s*/g, "");
  h = h.replace(/<script id="beam-coolicons-sprite">[\s\S]*?<\/script>\s*/g, "");

  // Disable beamTagIcons body (keep function name so callers don't throw)
  if (h.includes("const beamTagIcons = () => {") && !h.includes("__beamTagIconsDisabled")) {
    h = h.replace(
      "const beamTagIcons = () => {",
      `const beamTagIcons = () => {
    /* __beamTagIconsDisabled — mask icon system retired; stock SVGs only */
    return;`
    );
  }

  // Also strip existing data-beam-icon on boot via tiny one-shot
  if (!h.includes("beam-untag-icons")) {
    const untag = `<script id="beam-untag-icons">
(() => {
  const scrub = () => {
    for (const el of document.querySelectorAll("[data-beam-icon],[data-beam-cool]")) {
      el.removeAttribute("data-beam-icon");
      el.removeAttribute("data-beam-icon-state");
      el.removeAttribute("data-beam-cool");
    }
  };
  scrub();
  document.addEventListener("DOMContentLoaded", scrub);
  setTimeout(scrub, 500);
  setTimeout(scrub, 2000);
})();
</script>`;
    if (h.includes("</body>")) h = h.replace("</body>", untag + "\n</body>");
    else h += "\n" + untag;
  }

  h = h.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=stockvis2"'
  );
  return h;
}

let n = 0;
for (const web of WEBS) {
  const htmlPath = path.join(web, "index.html");
  const cssPath = path.join(web, "assets/beam-override.css");
  if (!fs.existsSync(htmlPath)) {
    console.log("skip", path.relative(ROOT, web));
    continue;
  }
  if (fs.existsSync(cssPath)) {
    const before = fs.readFileSync(cssPath, "utf8");
    const after = fixCss(before);
    fs.writeFileSync(cssPath, after);
    const stillBad =
      /newSession[^\n]*svg \*[^{]*\{[^}]*transparent/i.test(after) ||
      /button\.wtg9ga_newSession svg \*[\s\S]{0,80}transparent/.test(after);
    console.log("css", path.relative(ROOT, web), "transparentLeft", stillBad);
  }
  fs.writeFileSync(htmlPath, fixHtml(fs.readFileSync(htmlPath, "utf8")));
  n++;
  console.log("html", path.relative(ROOT, web));
}
console.log("RESTORE stock icons", n);
