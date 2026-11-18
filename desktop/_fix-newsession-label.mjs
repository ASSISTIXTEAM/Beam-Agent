/**
 * Restore «Новая сессия» on the sidebar New Session button.
 * Cause: beamTagIcons tagged newSessionLabel/Content/Mask spans with
 * data-beam-icon="plus", and CSS `span[data-beam-icon="plus"]` forced them
 * to a 14×14 plus mask — crushing the visible label text.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const WEBS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
];

const PROTECT_CSS = `
/* ===== BEAM fix: New Session label must stay text ===== */
[class*="newSessionLabel"],
[class*="newSessionContent"],
[class*="newSessionLabelMask"],
[class*="newSessionShortcut"] {
  -webkit-mask: none !important;
  mask: none !important;
  background: transparent !important;
  background-color: transparent !important;
  min-width: 0 !important;
  min-height: 0 !important;
  font-size: inherit !important;
  color: inherit !important;
  opacity: 1 !important;
}
[class*="newSessionLabelMask"] { flex: 1 !important; width: auto !important; height: auto !important; }
[class*="newSessionContent"] {
  display: flex !important;
  width: 100cqw !important;
  height: auto !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
}
[class*="newSessionLabel"] {
  display: inline !important;
  width: auto !important;
  height: auto !important;
  max-width: 200px !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}
`;

function patchCss(file) {
  if (!fs.existsSync(file)) return false;
  let css = fs.readFileSync(file, "utf8");
  const orig = css;

  // Stop masking arbitrary spans as icons (keeps SVG hosts).
  css = css.replace(
    /\[data-beam-icon="([^"]+)"\] svg,\s*\n\[data-beam-icon="\1"\] > i,\s*\nspan\[data-beam-icon="\1"\] \{/g,
    `[data-beam-icon="$1"] > svg,
[data-beam-icon="$1"] svg.beam-replaced,
[data-beam-icon="$1"] > i,
button[data-beam-icon="$1"] > span > svg,
[class*="panelGlyph"][data-beam-icon="$1"] svg,
[class*="iconButton"][data-beam-icon="$1"] svg {`
  );

  // Narrow opacity wipe so text children of tagged buttons survive.
  css = css.replace(
    /\[data-beam-icon="([^"]+)"\] svg \*,\s*\n\[data-beam-icon="\1"\]\.beam-icon-host \* \{/g,
    `[data-beam-icon="$1"] > svg *,
[data-beam-icon="$1"] svg.beam-replaced *,
[data-beam-icon="$1"].beam-icon-host > svg * {`
  );

  // Replace overly broad newSession svg rule.
  css = css.replace(
    /\/\* Sidebar New Session \*\/\s*\.wtg9ga_newSession svg,\s*\[class\*="newSession"\] svg \{[\s\S]*?\[class\*="newSession"\] svg \* \{ opacity: 0 !important; fill: transparent !important; stroke: transparent !important; \}/,
    `/* Sidebar New Session — icon SVG only; keep label text readable */
.wtg9ga_newSessionContent > svg,
button.wtg9ga_newSession svg {
  color: inherit !important;
  background-color: currentColor !important;
  -webkit-mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/plus.svg") center / contain no-repeat !important;
}
.wtg9ga_newSessionContent > svg *,
button.wtg9ga_newSession svg * { opacity: 0 !important; fill: transparent !important; stroke: transparent !important; }`
  );

  if (!css.includes("BEAM fix: New Session label must stay text")) {
    css += "\n" + PROTECT_CSS;
  }

  if (css !== orig) {
    fs.writeFileSync(file, css);
    return true;
  }
  return false;
}

function patchIndex(file) {
  if (!fs.existsSync(file)) return false;
  let html = fs.readFileSync(file, "utf8");
  const orig = html;

  // Prefer exact live injector shape.
  if (html.includes("[class*='newSession']")) {
    html = html.replace(
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelGlyph'], [class*='iconButton'], [class*='newSession']");`,
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelGlyph'], [class*='iconButton']");`
    );
    html = html.replace(
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelRow'], [class*='panelGlyph'], [class*='iconButton'], [class*='newSession']");`,
      `const nodes = document.querySelectorAll("button, [role='button'], [class*='panelRow'], [class*='panelGlyph'], [class*='iconButton']");`
    );
  }

  if (!html.includes("beamStripNewSessionIconHosts")) {
    const strip = `
  const beamStripNewSessionIconHosts = () => {
    for (const el of document.querySelectorAll('[class*="newSessionLabel"], [class*="newSessionContent"], [class*="newSessionLabelMask"], [class*="newSessionShortcut"]')) {
      el.removeAttribute("data-beam-icon");
      el.removeAttribute("data-beam-icon-state");
    }
  };
`;
    if (html.includes("const beamTagIcons = () => {")) {
      html = html.replace(
        "const beamTagIcons = () => {",
        strip + "\n  const beamTagIcons = () => {\n    beamStripNewSessionIconHosts();"
      );
    }
  }

  // Ensure strip also runs when beamTagIcons already has a different first line
  if (html.includes("beamStripNewSessionIconHosts") && html.includes("beamStripWorkspaceFolderTags();")) {
    // ok — strip is inside beamTagIcons via our insert; also call from workspace strip path if needed
  }

  if (html !== orig) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

for (const web of WEBS) {
  console.log("WEB", web, "exists=", fs.existsSync(web));
  if (!fs.existsSync(web)) continue;
  console.log(" css:", patchCss(path.join(web, "assets/beam-override.css")));
  console.log(" index:", patchIndex(path.join(web, "index.html")));
}
console.log("DONE");
