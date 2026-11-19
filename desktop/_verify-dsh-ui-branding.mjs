import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "runtime/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-chat/lib/client.js",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js",
  "runtime/app/lib/main.js",
  "dist/Beam-Agent/resources/app/lib/main.js",
  "desktop/bridge/server.js",
  "dist/Beam-Agent/bridge/server.js",
];

let fail = 0;
for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    console.log("MISSING", rel);
    fail++;
    continue;
  }
  const s = fs.readFileSync(p, "utf8");
  const hasOld = /The DSH process|when DSH restarted|DSH 进程|Manage dsh Command|Restart DSH to apply/.test(s);
  const hasNew =
    /The Beam process exited before this turn finished/.test(s) ||
    /Manage Beam Command/.test(s) ||
    /\\bDSH\\b/.test(s) && rel.includes("bridge");
  console.log(
    (hasOld ? "FAIL" : "OK  "),
    rel,
    hasOld ? "still has DSH UI copy" : hasNew || !rel.includes("chat") ? "clean/branded" : "check"
  );
  if (hasOld) fail++;
}

// Scan assistix + deepseek UI clients for leftover quoted DSH
const roots = [
  "runtime/app/beam/node_modules/@assistix",
  "runtime/app/beam/node_modules/@deepseek-ai",
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai",
].map((r) => path.join(ROOT, r));

const leftover = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/client\.js$|en\.json$|zh\.json$|index\.html$|main\.js$/.test(ent.name)) {
      const s = fs.readFileSync(p, "utf8");
      const re = /:\s*"[^"]*\bDSH\b[^"]*"/g;
      let m;
      while ((m = re.exec(s))) leftover.push({ file: p, sample: m[0].slice(0, 120) });
    }
  }
}
for (const r of roots) walk(r);
console.log("quoted-DSH leftovers:", leftover.length);
for (const x of leftover.slice(0, 20)) console.log("-", path.relative(ROOT, x.file), x.sample);
process.exit(fail || leftover.length ? 1 : 0);
