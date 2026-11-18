import fs from "node:fs";
const s = fs.readFileSync(
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js",
  "utf8"
);
const lines = s.split(/\n/);
for (let i = 0; i < lines.length; i++) {
  if (/\b(?:const|let|var)\s+ru\b/.test(lines[i]) || /\bru\s*=\s*\{/.test(lines[i])) {
    console.log(i + 1, lines[i].trim().slice(0, 100));
  }
}
// Also search for function params named ru near locales
for (let i = 16000; i < 16840; i++) {
  if (/\bru\b/.test(lines[i])) {
    // skip string contents mostly
    if (lines[i].includes('"') && !lines[i].includes("const")) continue;
    console.log("near", i + 1, lines[i].trim().slice(0, 120));
  }
}
