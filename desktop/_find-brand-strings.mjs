import fs from "node:fs";
import path from "node:path";

const roots = [
  "runtime/app/dsh/node_modules/@deepseek-ai",
  "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai",
  "runtime/app",
  "dist/Beam Agent/resources/app",
  "desktop",
];

const needles = [
  "Build with Beam",
  "Build with",
  "logoRow",
  "brandMark",
  "railMark",
  "beam-mark",
];

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" && !dir.includes("@deepseek-ai")) continue;
      if (e.name === ".git" || e.name === "langs") continue;
      walk(p, out);
    } else if (/\.(js|css|html|json|svg|mjs|cjs|ts|tsx|yaml|yml|md)$/i.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const files = walk(root);
  for (const file of files) {
    let data;
    try {
      data = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const n of needles) {
      let idx = data.indexOf(n);
      if (idx < 0) continue;
      // only first few hits per file/needle
      let hits = 0;
      while (idx >= 0 && hits < 3) {
        const snip = data.slice(Math.max(0, idx - 70), idx + 90).replace(/\s+/g, " ");
        console.log(`${file}\n  [${n}] ${snip}\n`);
        hits++;
        idx = data.indexOf(n, idx + n.length);
      }
    }
  }
}

// Also dump Preview contexts that look like UI badge (short quoted)
const indexJs =
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js";
if (fs.existsSync(indexJs)) {
  const data = fs.readFileSync(indexJs, "utf8");
  console.log("\n=== index counts ===");
  for (const n of ["Build with Beam", "Build with", "Preview", "logoRow", "brandMark", "Harness", "DeepSeek"]) {
    console.log(n, (data.match(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length);
  }
  let i = 0;
  let from = 0;
  while ((from = data.indexOf("Preview", from)) >= 0 && i < 25) {
    const snip = data.slice(Math.max(0, from - 50), from + 60).replace(/\s+/g, " ");
    if (/["'`]Preview["'`]/.test(snip) || /children:\s*["']Preview/.test(snip) || snip.includes("badge") || snip.includes("pill")) {
      console.log("Preview ctx:", snip);
      i++;
    }
    from += 7;
  }
}
