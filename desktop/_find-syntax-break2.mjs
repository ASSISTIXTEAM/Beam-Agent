import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const curPath =
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js";
const tmpPath =
  "_tmp_app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js";

const s = fs.readFileSync(curPath, "utf8");
const t = fs.readFileSync(tmpPath, "utf8");
const sLines = s.split("\n");
const tLines = t.split("\n");
console.log("cur lines", sLines.length, "tmp lines", tLines.length);

// Diff line by line lengths / first mismatch
const n = Math.min(sLines.length, tLines.length);
for (let i = 0; i < n; i++) {
  if (sLines[i] !== tLines[i]) {
    console.log("first line mismatch", i + 1, "curLen", sLines[i].length, "tmpLen", tLines[i].length);
    let j = 0;
    while (j < sLines[i].length && j < tLines[i].length && sLines[i][j] === tLines[i][j]) j++;
    console.log("col", j);
    console.log("CUR", JSON.stringify(sLines[i].slice(Math.max(0, j - 60), j + 80)));
    console.log("TMP", JSON.stringify(tLines[i].slice(Math.max(0, j - 60), j + 80)));
    break;
  }
}

// Binary search syntax: write prefixes of CUR to temp and --check
function checkText(text) {
  const f = path.join(os.tmpdir(), "beam-syntax-check.js");
  fs.writeFileSync(f, text);
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  return { ok: r.status === 0, err: (r.stderr || "").split("\n").slice(0, 4).join(" | ") };
}

// Check by cumulative lines
let lo = 1,
  hi = sLines.length;
// Find first line where prefix becomes invalid? Actually import makes --check fail differently.
// Strip to use acorn? Try: check from line 100-140 region by wrapping.

// Use Function on expression after removing import/export - hard.

// Locate via: for each odd region, replace line with tmp equivalent
// Restore lines that differ from tmp until syntax OK

const differ = [];
for (let i = 0; i < n; i++) {
  if (sLines[i] !== tLines[i]) differ.push(i + 1);
}
console.log("differing lines count", differ.length, "first", differ.slice(0, 30));

// Full file check both
console.log("cur check", checkText(s).ok, checkText(s).err.slice(0, 200));
console.log("tmp check", checkText(t).ok, checkText(t).err.slice(0, 200));

// If tmp parses, restore cur from tmp for both assistix trees + deepseek copies
if (checkText(t).ok || !checkText(s).ok) {
  // tmp also may fail --check due to import - compare error messages
  const a = checkText(s);
  const b = checkText(t);
  console.log("cur ok?", a.ok, a.err.slice(0, 300));
  console.log("tmp ok?", b.ok, b.err.slice(0, 300));
}
