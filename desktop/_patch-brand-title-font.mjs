import fs from "node:fs";
import path from "node:path";

const cssPaths = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/cloud/ship/assets/beam/override.css",
];

const FONT_BLOCK = `/* Brand title — single Regular file (not Savona weight ladder) */
@font-face {
  font-family: "Savona Brand Title";
  src: url("./fonts/savona/Savona-Regular.woff2") format("woff2"),
       url("./fonts/savona/Savona-Regular.woff") format("woff");
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

`;

const PARENT_PIN = `/* Override upstream .wtg9ga_brandName { font-weight:600 } + headline { font-weight:500 } */
[class*="brandIdentity"],
.wtg9ga_brandIdentity,
[class*="localBuildBrand"],
.wtg9ga_brand,
[class*="headline"] [class*="titleGroup"],
[class*="WOwLGG_headline"] [class*="WOwLGG_titleGroup"] {
  font-weight: normal !important;
  font-synthesis: none !important;
}

`;

const htmlPaths = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
];

for (const p of cssPaths) {
  if (!fs.existsSync(p)) {
    console.log("skip css", p);
    continue;
  }
  let c = fs.readFileSync(p, "utf8");
  if (!c.includes("Savona Brand Title")) {
    c = c.replace(
      "/* ===== Savona UI + chat prose (keep mono for code) ===== */",
      FONT_BLOCK + "/* ===== Savona UI + chat prose (keep mono for code) ===== */",
    );
  }
  if (!c.includes("Override upstream .wtg9ga_brandName")) {
    c = c.replace(
      "/* Clean title group next to logo */",
      PARENT_PIN + "/* Clean title group next to logo */",
    );
  }
  c = c.replace(
    /(\[class\*="titleGroup"\] > span:first-child,\s*\n\[class\*="WOwLGG_titleGroup"\] > span:first-child,\s*\n\[class\*="brandName"\],\s*\n\.wtg9ga_brandName,\s*\n\[class\*="fallbackBrandName"\],\s*\n\[class\*="localBuildTitle"\] \{\s*\n\s*)font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;\s*\n\s*font-weight: 400 !important;/,
    '$1font-family: "Savona Brand Title", "Segoe UI", system-ui, sans-serif !important;\n  font-weight: normal !important;',
  );
  c = c.replace(
    /\.wtg9ga_brandName, \[class\*="brandName"\], \[class\*="localBuildTitle"\], \[class\*="fallbackBrandName"\] \{\s*\n\s*color: var\(--dsw-alias-label-primary, #e8f7f5\) !important;\s*\n\s*font-size: 16px !important;\s*\n\s*line-height: 1\.25 !important;\s*\n\s*font-weight: 400 !important;\s*\n\s*font-synthesis: none !important;/,
    '.wtg9ga_brandName, [class*="brandName"], [class*="localBuildTitle"], [class*="fallbackBrandName"] {\n  color: var(--dsw-alias-label-primary, #e8f7f5) !important;\n  font-family: "Savona Brand Title", "Segoe UI", system-ui, sans-serif !important;\n  font-size: 16px !important;\n  line-height: 1.25 !important;\n  font-weight: normal !important;\n  font-synthesis: none !important;',
  );
  c = c.replace(
    /font-family: "Savona", "Segoe UI", system-ui, sans-serif !important;\s*\n\s*font-weight: 500 !important;/,
    'font-family: "Savona Brand Title", "Segoe UI", system-ui, sans-serif !important;\n  font-weight: normal !important;\n  font-synthesis: none !important;',
  );
  fs.writeFileSync(p, c);
  console.log("css", path.basename(p), c.includes("Savona Brand Title"));
}

const jsOld =
  'el.style.setProperty("font-weight", "400", "important");\n        el.style.setProperty("font-synthesis", "none", "important");';
const jsNew =
  'el.style.setProperty("font-family", "\\"Savona Brand Title\\", \\"Segoe UI\\", system-ui, sans-serif", "important");\n        el.style.setProperty("font-weight", "normal", "important");\n        el.style.setProperty("font-synthesis", "none", "important");';

for (const p of htmlPaths) {
  if (!fs.existsSync(p)) {
    console.log("skip html", p);
    continue;
  }
  let h = fs.readFileSync(p, "utf8");
  // Keep existing cache-bust (icons / other agents); only set one if missing.
  if (!/href="\.\/assets\/beam-override\.css\?[^"]+"/.test(h)) {
    h = h.replace(
      /href="\.\/assets\/beam-override\.css"/g,
      'href="./assets/beam-override.css?v=brand-title-font1"',
    );
  }
  if (h.includes(jsOld)) h = h.replace(jsOld, jsNew);
  fs.writeFileSync(p, h);
  console.log("html v5", p);
}