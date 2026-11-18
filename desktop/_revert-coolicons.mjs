/**
 * Full revert of coolicons injection experiments.
 * Restores stock DSH/Beam inline SVG icons (no force script, no FORCE CSS).
 * Keeps: boot-hidden fix, locale bootstrap, other non-icon patches.
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

function revertHtml(html) {
  let h = html;
  // Remove all coolicons injectors
  h = h.replace(/<script id="beam-coolicons-force">[\s\S]*?<\/script>\s*/g, "");
  h = h.replace(/<script id="beam-coolicons-sprite">[\s\S]*?<\/script>\s*/g, "");
  // Bust CSS cache so FORCE rules drop
  h = h.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=precoolicons"'
  );
  return h;
}

function revertCss(css) {
  let s = css;
  // Drop every coolicons FORCE generation
  s = s.replace(/\/\* ===== BEAM coolicons FORCE[\s\S]*?(?=\/\* =====|$)/g, "");
  // Drop mask-disable comments residue that blanked icons without replacement
  // Restore nothing aggressive — stock SVGs paint themselves
  // Remove broad "opacity restored" / svg* opacity 1 blocks from coolicons era
  s = s.replace(/\/\* coolicons:[\s\S]*?\*\//g, "/* */");
  s = s.replace(/\/\* v8:[\s\S]*?\*\//g, "/* */");
  s = s.replace(
    /svg\[data-beam-cool="1"\][\s\S]*?(?=\/\* =====|$)/g,
    ""
  );
  // Kill rules that force every button svg child visible (wrecked gauges)
  s = s.replace(
    /button\[aria-label\] svg \*,[\s\S]*?visibility:\s*visible\s*!important;[\s\S]*?\}/g,
    "/* reverted: no broad button svg* opacity */"
  );
  s = s.replace(
    /\.wtg9ga_newSession svg \*,\s*button\[class\*="newSession"\] svg \* \{[^}]*opacity:\s*1\s*!important;[^}]*\}/g,
    "/* reverted */"
  );
  // Ensure boot-hidden still works (needed for splash)
  if (!s.includes("BEAM boot must honor hidden")) {
    s += `

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
  }
  return s;
}

let n = 0;
for (const web of WEBS) {
  const htmlPath = path.join(web, "index.html");
  const cssPath = path.join(web, "assets/beam-override.css");
  if (!fs.existsSync(htmlPath)) {
    console.log("skip", path.relative(ROOT, web));
    continue;
  }
  let html = fs.readFileSync(htmlPath, "utf8");
  const had = html.includes("beam-coolicons-force");
  html = revertHtml(html);
  fs.writeFileSync(htmlPath, html);

  if (fs.existsSync(cssPath)) {
    fs.writeFileSync(cssPath, revertCss(fs.readFileSync(cssPath, "utf8")));
  }
  n++;
  console.log("reverted", path.relative(ROOT, web), "hadCoolicons", had, "now", html.includes("beam-coolicons-force"));
}

console.log("REVERT DONE", n);
console.log("Stock icons only. Reload Beam Agent (full Quit + Start).");
