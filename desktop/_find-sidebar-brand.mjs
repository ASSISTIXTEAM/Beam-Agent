import fs from "node:fs";

const p = "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js";
const d = fs.readFileSync(p, "utf8");
const keys = [
  "Build with",
  "Preview",
  "brandName",
  "buildVersion",
  "Beam Agent",
  "Harness",
  "DeepSeek",
  "wordmark",
  "logo",
  "build with",
];
for (const k of keys) console.log(k, d.split(k).length - 1);

const patterns = [
  /Build with.{0,40}/g,
  /"Preview"/g,
  /'Preview'/g,
  /buildVersion/g,
  /brandName[^,]{0,80}/g,
  /t\(["'][^"']+["']\)/g,
];

function dump(re, limit = 30) {
  let m;
  let i = 0;
  re.lastIndex = 0;
  while ((m = re.exec(d)) && i < limit) {
    console.log("\nMATCH", m[0]);
    console.log(d.slice(Math.max(0, m.index - 100), m.index + 140).replace(/\s+/g, " "));
    i++;
  }
}

dump(/Build with.{0,50}/g, 20);
dump(/["']Preview["']/g, 20);

// Find i18n message dictionaries with brand-ish keys
const idx = d.indexOf("buildVersion");
console.log("\n--- around first buildVersion ---");
console.log(d.slice(Math.max(0, idx - 500), idx + 800).replace(/\s+/g, " "));

// Search for messages object containing Preview
let from = 0;
let hits = 0;
while ((from = d.indexOf("Preview", from)) >= 0 && hits < 15) {
  const snip = d.slice(Math.max(0, from - 120), from + 80).replace(/\s+/g, " ");
  if (/["']Preview["']/.test(snip) || /:\s*Preview/.test(snip)) {
    console.log("\nPreview@", from, snip);
    hits++;
  }
  from += 7;
}
