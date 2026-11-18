import fs from "node:fs";
import path from "node:path";

const dsh = "runtime/app/dsh/node_modules/@deepseek-ai";
let withRu = 0;
let missingRu = 0;
let englishHeavy = [];

for (const name of fs.readdirSync(dsh)) {
  if (!name.startsWith("dsh-client")) continue;
  const p = path.join(dsh, name, "lib", "client.js");
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, "utf8");
  if (!/locale\.register\(/.test(s)) continue;
  const hasRu = /locale\.register\([^)]*\bru\b/.test(s) || /\/\/ #region beam-ru/.test(s) || /\bconst ru\b/.test(s);
  if (hasRu) withRu++;
  else {
    missingRu++;
    englishHeavy.push(name);
  }
}

console.log({ withRu, missingRu, englishHeavy: englishHeavy.slice(0, 30) });

// Sample remaining English UI strings in conversation en dict around common labels
const conv = fs.readFileSync(path.join(dsh, "dsh-client-ui-conversation/lib/client.js"), "utf8");
const enIdx = conv.indexOf('"hero.headline"');
console.log("hero around", conv.slice(enIdx - 50, enIdx + 120));

// Check register site
const reg = [...conv.matchAll(/locale\.register\([^)]+\)/g)].slice(0, 8);
console.log("registers", reg.map((m) => m[0]));

// Count beam-ru regions across packages
let regions = 0;
for (const name of fs.readdirSync(dsh)) {
  const p = path.join(dsh, name, "lib", "client.js");
  if (!fs.existsSync(p)) continue;
  const s = fs.readFileSync(p, "utf8");
  regions += (s.match(/\/\/ #region beam-ru/g) || []).length;
}
console.log("beam-ru regions", regions);
