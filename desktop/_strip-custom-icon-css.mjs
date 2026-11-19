/**
 * Remove the entire BEAM custom icons / mask CSS block that paints
 * background-color squares and fights stock SVGs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPaths = [
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
].map((p) => path.join(ROOT, p));

const REPLACEMENT = `
/* ===== BEAM custom icons — REVERTED (stock app SVGs only) ===== */
/* Previous mask/background-color icon overrides removed — they broke gauges & duplicated glyphs. */
/* ===== /BEAM custom icons ===== */
`;

for (const p of cssPaths) {
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf8");
  const start = s.indexOf("/* ===== BEAM custom icons");
  const end = s.indexOf("/* ===== /BEAM custom icons ===== */");
  if (start >= 0 && end > start) {
    const endLine = end + "/* ===== /BEAM custom icons ===== */".length;
    s = s.slice(0, start) + REPLACEMENT + s.slice(endLine);
    console.log("stripped custom icons block", path.relative(ROOT, p));
  } else {
    console.log("no custom icons block markers", path.relative(ROOT, p));
  }

  // Drop leftover coolicons footer
  s = s.replace(/\/\* ===== BEAM coolicons =====[\s\S]*?(?=\/\* =====|$)/g, "");

  // Soften UX fix that force-fills ALL svg children (can bloat rings if tagged)
  s = s.replace(
    /\[data-beam-icon\][^{]*svg \*[^{]*\{[^}]*fill:\s*currentColor\s*!important;[^}]*\}/g,
    "/* reverted aggressive data-beam-icon svg* fill */"
  );

  fs.writeFileSync(p, s);
}

// Bust cache on html
for (const rel of [
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
]) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, "utf8");
  h = h.replace(/<script id="beam-coolicons-force">[\s\S]*?<\/script>\s*/g, "");
  h = h.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=stockicons1"'
  );
  fs.writeFileSync(p, h);
  console.log("html cache", rel, "coolicons?", h.includes("beam-coolicons-force"));
}

console.log("custom icon CSS stripped");
