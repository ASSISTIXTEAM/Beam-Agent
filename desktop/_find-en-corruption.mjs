import fs from "node:fs";
import path from "node:path";

const roots = [
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/runtime/app/beam/node_modules/@assistix",
];

const reBroken = /\{\s*:\s*\$/;
const reBroken2 = /,\s*en,\s*ru:\s*en\$/;
const reBroken3 = /register\([^;]{0,80}\{\s*:/;

const hits = [];
function walk(d) {
  let entries;
  try {
    entries = fs.readdirSync(d, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      walk(p);
    } else if (/\.(js|mjs|cjs)$/.test(e.name)) {
      const s = fs.readFileSync(p, "utf8");
      if (reBroken.test(s) || reBroken2.test(s) || reBroken3.test(s)) hits.push(p);
    }
  }
}

for (const r of roots) walk(r);
const uniq = [...new Set(hits)];
console.log("hits", uniq.length);
for (const h of uniq) {
  const s = fs.readFileSync(h, "utf8");
  const m = s.match(/.{0,40}\{\s*:\s*\$[^;]{0,80}/);
  console.log("\n", h);
  if (m) console.log(" ", m[0].replace(/\s+/g, " "));
}
