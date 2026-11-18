import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webs = [
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
];

for (const rel of webs) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf8");
  const before = s.length;
  // Remove any leftover FORCE V5-V7 blocks entirely
  s = s.replace(/\/\* ===== BEAM coolicons FORCE V[5-7][\s\S]*?(?=\/\* =====|$)/g, "");
  // Broad opacity:1 on all button svg children — kills layered gauges
  s = s.replace(
    /button\[aria-label\] svg \*,[\s\S]*?visibility:\s*visible\s*!important;[\s\S]*?\}/g,
    "/* v8: removed broad button svg* opacity */"
  );
  fs.writeFileSync(p, s);
  console.log(rel, before, "->", s.length, "hasV8", s.includes("FORCE V8"));
}
