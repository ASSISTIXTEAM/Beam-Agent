import fs from "node:fs";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

const paths = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
  "_tmp_app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
];

for (const p of paths) {
  if (!fs.existsSync(p)) {
    console.log("MISS", p);
    continue;
  }
  const buf = fs.readFileSync(p);
  const h = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
  console.log(h, buf.length, p);
}

// Parse with esbuild/acorn if available; else node --check via temp wrapper won't work for ESM.
// Extract Chromium-reported line 129: file has few lines — use offset by splitting on \n and also search L129 as column?
const target = paths[0];
const text = fs.readFileSync(target, "utf8");
const lines = text.split("\n");
console.log("lineCount", lines.length);
if (lines.length >= 129) {
  console.log("L129 head", JSON.stringify(lines[128].slice(0, 300)));
} else {
  // Chromium often reports line within transformed source; find SyntaxError via dynamic import
  const tmp = path.resolve("desktop/_tmp_index_check.mjs");
  fs.writeFileSync(tmp, text);
  const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  console.log("node --check status", r.status);
  console.log((r.stderr || r.stdout || "").slice(0, 1500));
  try {
    fs.unlinkSync(tmp);
  } catch {}
}

// Compare assistix vs deepseek vs tmp
function snipDiff(a, b, label) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return;
  const A = fs.readFileSync(a, "utf8");
  const B = fs.readFileSync(b, "utf8");
  if (A === B) {
    console.log("IDENTICAL", label);
    return;
  }
  console.log("DIFF", label, "a", A.length, "b", B.length);
  let i = 0;
  while (i < A.length && i < B.length && A[i] === B[i]) i++;
  console.log("firstDiff@", i, "A", JSON.stringify(A.slice(i, i + 80)), "B", JSON.stringify(B.slice(i, i + 80)));
}

snipDiff(paths[0], paths[2], "assistix-runtime vs deepseek-runtime");
snipDiff(paths[0], paths[4], "assistix-runtime vs _tmp");
snipDiff(paths[2], paths[4], "deepseek-runtime vs _tmp");
