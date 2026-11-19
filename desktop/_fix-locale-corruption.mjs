/**
 * Fix locale patch corruption:
 *   { : $6, en, ru: en$6 }  →  { en: en$6, ru: en$6 }
 * Also scan/fix any similar mangled register() objects.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bases = [
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules"),
  path.join(ROOT, "runtime/app/beam/node_modules"),
];

function walk(d, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(d, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      walk(p, out);
    } else if (e.name === "client.js" || e.name.endsWith(".js")) {
      out.push(p);
    }
  }
  return out;
}

let fixedFiles = 0;
let fixedCount = 0;

for (const base of bases) {
  if (!fs.existsSync(base)) continue;
  for (const file of walk(base)) {
    let s = fs.readFileSync(file, "utf8");
    if (!/\{\s*:\s*\$/.test(s)) continue;
    const orig = s;

    // Pattern A (multiline):
    // { : $6,\n\t\ten, ru: en$6 }
    s = s.replace(
      /\{\s*:\s*(\$[0-9]+)\s*,\s*en\s*,\s*ru:\s*(en\$[0-9]+)\s*\}/g,
      "{ en: $2, ru: $2 }"
    );

    // Pattern B if variable names differ slightly
    s = s.replace(
      /\{\s*:\s*(\$[0-9]+)\s*,\s*en\s*,\s*ru:\s*(en\$[0-9]+)\s*\}/g,
      "{ en: $2, ru: $2 }"
    );

    // Pattern C single-line leftovers
    s = s.replace(
      /\{\s*:\s*\$[0-9]+\s*,\s*en\s*,\s*ru:\s*(en\$[0-9]+)\s*\}/g,
      "{ en: $1, ru: $1 }"
    );

    if (s !== orig) {
      fs.writeFileSync(file, s);
      const n = (orig.match(/\{\s*:\s*\$/g) || []).length;
      fixedFiles++;
      fixedCount += n;
      console.log("fixed", path.relative(ROOT, file), "approx", n);
    } else {
      console.log("UNFIXED still broken?", path.relative(ROOT, file));
      const m = s.match(/.{0,30}\{\s*:\s*\$[^}]{0,60}/);
      if (m) console.log(" ", m[0]);
    }
  }
}

// Verify no leftovers
let left = 0;
for (const base of bases) {
  if (!fs.existsSync(base)) continue;
  for (const file of walk(base)) {
    const s = fs.readFileSync(file, "utf8");
    const n = (s.match(/\{\s*:\s*\$/g) || []).length;
    if (n) {
      left += n;
      console.log("LEFT", n, path.relative(ROOT, file));
    }
  }
}
console.log("DONE files", fixedFiles, "approxFixes", fixedCount, "left", left);
