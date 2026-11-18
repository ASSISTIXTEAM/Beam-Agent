import fs from "node:fs";

const curPath =
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js";
const tmpPath =
  "_tmp_app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js";

const s = fs.readFileSync(curPath, "utf8");
const t = fs.readFileSync(tmpPath, "utf8");
const lines = s.split("\n");
console.log("lines", lines.length, "bytes", s.length);

const idx = s.indexOf("yaml:");
const idx2 = t.indexOf("yaml:");
console.log("yaml@", idx, "tmp@", idx2);
console.log("CUR", JSON.stringify(s.slice(idx, idx + 400)));
console.log("TMP", JSON.stringify(t.slice(idx2, idx2 + 400)));

// Binary search: find smallest prefix that fails --check via Function constructor on stripped imports
// Better: scan for broken template by comparing line lengths
for (let i = 0; i < Math.min(lines.length, 140); i++) {
  if (lines[i].length > 50000) console.log("huge line", i + 1, lines[i].length);
}

// Find first position where character differs that could break syntax before L129
// Focus on content before line 129
const before = lines.slice(0, 129).join("\n");
const afterStart = before.length;
console.log("chars before L129", before.length);

// Look for odd patterns: bare number after backtick close failures
const weird = [];
const re = /`[^`]*$/gm; // unclosed at EOL - check lines 1-128
for (let i = 0; i < 129; i++) {
  const line = lines[i];
  const ticks = [...line].filter((c) => c === "`").length;
  if (ticks % 2 !== 0) weird.push({ line: i + 1, ticks, head: line.slice(0, 80), tail: line.slice(-80) });
}
console.log("odd-tick lines before 129:", weird.length);
for (const w of weird.slice(0, 20)) console.log(JSON.stringify(w));

// Show lines 125-131 short
for (let i = 124; i < Math.min(132, lines.length); i++) {
  console.log("L" + (i + 1), "len", lines[i].length, "ticks", [...lines[i]].filter((c) => c === "`").length);
}
