import fs from "node:fs";

const p = "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-locale/lib/client.js";
const d = fs.readFileSync(p, "utf8");
console.log("len", d.length);

// Find locale codes
for (const k of ["zh-CN", "en-US", "en", "zh", "ru", "locale", "messages"]) {
  console.log(k, d.split(k).length - 1);
}

// Extract brand.localBuild neighborhoods and language object starts
const markers = ['"brand.localBuild"', "registerLocale", "locales", "en-US", "zh-CN", "ru"];
for (const m of markers) {
  const i = d.indexOf(m);
  if (i >= 0) console.log("\nMARKER", m, d.slice(Math.max(0, i - 60), i + 200).replace(/\s+/g, " "));
}

// Find how many top-level message keys in English dict around brand.localBuild
const enIdx = d.indexOf('"brand.localBuild": "DSH Local Build"');
console.log("\nEN around", d.slice(enIdx - 2000, enIdx + 500));

// Count approximate English UI string entries like "key": "English"
const enBlockStart = d.lastIndexOf("{", enIdx);
const enBlock = d.slice(enBlockStart, enBlockStart + 50000);
const keys = [...enBlock.matchAll(/"([^"]+)":\s*"([^"\\]|\\.)*"/g)].slice(0, 5);
console.log("sample keys near en brand", keys.map((x) => x[0]).slice(0, 5));

// Find all locales registered
const locMatches = [...d.matchAll(/["'](en(?:-US)?|zh(?:-CN)?|ru(?:-RU)?)["']/g)].map((m) => m[1]);
console.log("locale literals", [...new Set(locMatches)]);
