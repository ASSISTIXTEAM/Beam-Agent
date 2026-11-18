import fs from "node:fs";
import path from "node:path";

const roots = [
  "runtime/app/dsh/node_modules/@deepseek-ai",
];

function walk(dir, out = []) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "langs" || e.name === "devtools") continue;
      walk(p, out);
    } else if (/\.(js|json|yaml|yml)$/i.test(e.name) && !e.name.includes(".pdf.")) {
      out.push(p);
    }
  }
  return out;
}

const needles = [
  "brand.localBuild",
  "localBuild",
  "Build with",
  "localBuildVersion",
  '"Preview"',
  "'Preview'",
];

const files = walk(roots[0]);
for (const f of files) {
  let d;
  try {
    d = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const n of needles) {
    if (!d.includes(n)) continue;
    let from = 0;
    let hits = 0;
    while ((from = d.indexOf(n, from)) >= 0 && hits < 2) {
      console.log(`\n${f}\n  ${n} =>`, d.slice(Math.max(0, from - 100), from + 140).replace(/\s+/g, " "));
      from += n.length;
      hits++;
    }
  }
}
