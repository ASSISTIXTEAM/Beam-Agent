/**
 * Repair corrupted locale.register({ : $N, ...}) left by a bad rewrite.
 * Restore from _tmp_app clean copies where available, then re-add safe { en, ru }.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Beam-Agent";
const TMP = path.join(ROOT, "_tmp_app/dsh/node_modules/@deepseek-ai");
const TREES = [
  path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai"),
];

function isBroken(s) {
  return /\{\s*:\s*\$\d+/.test(s) || /locale\.register\([^)]*\{\s*:/.test(s);
}

function copyCleanClient(pkg) {
  const src = path.join(TMP, pkg, "lib/client.js");
  if (!fs.existsSync(src)) return null;
  return fs.readFileSync(src, "utf8");
}

function softAddRu(s) {
  // Only touch simple multiline registers: { zh, en } / { en, zh } / named on one or few lines
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*zh,\s*\n\s*en\s*\n\s*\}\)/g,
    "locale.register($1, {\n\t\t\t\ten,\n\t\t\t\tru\n\t\t\t})"
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*en,\s*\n\s*zh\s*\n\s*\}\)/g,
    "locale.register($1, {\n\t\t\t\ten,\n\t\t\t\tru\n\t\t\t})"
  );
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*zh\s*,\s*en\s*\}\)/g, "locale.register($1, { en, ru })");
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*zh\s*\}\)/g, "locale.register($1, { en, ru })");

  // Named multiline: zh: zh$N, en: en$N
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*zh:\s*(zh(?:\$\d+)?)\s*,\s*\n\s*en:\s*(en(?:\$\d+)?)\s*\n\s*\}\)/g,
    (all, ns, zhName, enName) => {
      const ruName = enName.replace(/^en/, "ru");
      return `locale.register(${ns}, {\n\t\t\t\ten: ${enName},\n\t\t\t\tru: ${enName}\n\t\t\t})`;
    }
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*en:\s*(en(?:\$\d+)?)\s*,\s*\n\s*zh:\s*(zh(?:\$\d+)?)\s*\n\s*\}\)/g,
    (all, ns, enName) =>
      `locale.register(${ns}, {\n\t\t\t\ten: ${enName},\n\t\t\t\tru: ${enName}\n\t\t\t})`
  );

  // One-line named
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*zh:\s*\w+\s*,\s*en:\s*(en(?:\$\d+)?)\s*\}\)/g,
    (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName} })`
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*en:\s*(en(?:\$\d+)?)\s*,\s*zh:\s*\w+\s*\}\)/g,
    (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName} })`
  );

  return s;
}

const brokenPkgs = new Set();
for (const tree of TREES) {
  for (const name of fs.readdirSync(tree)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(tree, name, "lib/client.js");
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8");
    if (isBroken(s)) brokenPkgs.add(name);
  }
}

console.log("broken packages", [...brokenPkgs]);

for (const pkg of brokenPkgs) {
  const clean = copyCleanClient(pkg);
  if (!clean) {
    console.log("NO CLEAN COPY", pkg);
    continue;
  }
  let fixed = softAddRu(clean);
  for (const tree of TREES) {
    const dest = path.join(tree, pkg, "lib/client.js");
    if (!fs.existsSync(path.dirname(dest))) continue;
    fs.writeFileSync(dest, fixed);
    const r = spawnSync(process.execPath, ["--check", dest], { encoding: "utf8" });
    console.log(
      path.basename(path.dirname(path.dirname(tree))),
      pkg,
      r.status === 0 ? "ok" : r.stderr.slice(0, 180)
    );
  }
}

// Also scan for any remaining broken
for (const tree of TREES) {
  for (const name of fs.readdirSync(tree)) {
    const p = path.join(tree, name, "lib/client.js");
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, "utf8");
    if (isBroken(s)) console.log("STILL BROKEN", tree.includes("runtime") ? "runtime" : "dist", name);
  }
}
