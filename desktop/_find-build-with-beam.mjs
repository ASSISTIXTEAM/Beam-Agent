import fs from "node:fs";
import path from "node:path";

const roots = [
  "desktop",
  "runtime/app",
  "dist/Beam-Agent/resources/app",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-locale",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend",
];

const needles = [
  "Build with Beam",
  "Build with",
  "sidebar.brand",
  "brand.localBuild",
  "localBuildBrand",
  "FishLogo",
  "Preview",
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
      if (["node_modules", "langs", "devtools", ".git"].includes(e.name)) continue;
      // for runtime/app allow diving into dsh selectively only if root is that
      walk(p, out);
    } else if (/\.(js|mjs|cjs|html|css|json|ts|tsx|svg)$/i.test(e.name)) {
      // skip huge pdf / vendor unless frontend
      if (e.name.includes(".pdf.") || e.name.startsWith("vendor-")) continue;
      out.push(p);
    }
  }
  return out;
}

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) {
    let d;
    try {
      d = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const n of needles) {
      if (!d.includes(n)) continue;
      // skip false positives for Preview in excel/pdf
      if (n === "Preview" && /excel|pdf|trajectory|inspector|devtools/i.test(f)) continue;
      let from = 0;
      let hits = 0;
      while ((from = d.indexOf(n, from)) >= 0 && hits < 2) {
        console.log(`\n${f}\n [${n}]`, d.slice(Math.max(0, from - 80), from + 100).replace(/\s+/g, " "));
        from += n.length;
        hits++;
      }
    }
  }
}
