/**
 * Restore schedule / documentpreview / permission-presets from clean _tmp_app,
 * then map zh→drop and add ru as alias of the EN dict (no bare `ru` identifier).
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

const pkgs = [
  "dsh-client-ui-schedule",
  "dsh-client-ui-sidebar-documentpreview",
  "dsh-client-ui-permission-presets",
];

function softAddRuAlias(s) {
  // multiline shorthand
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*zh,\s*\n\s*en\s*\n\s*\}\)/g,
    "locale.register($1, {\n\t\t\t\ten,\n\t\t\t\tru: en\n\t\t\t})"
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*en,\s*\n\s*zh\s*\n\s*\}\)/g,
    "locale.register($1, {\n\t\t\t\ten,\n\t\t\t\tru: en\n\t\t\t})"
  );
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*zh\s*,\s*en\s*\}\)/g, "locale.register($1, { en, ru: en })");
  s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*zh\s*\}\)/g, "locale.register($1, { en, ru: en })");

  // named multiline
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*zh:\s*\w+\s*,\s*\n\s*en:\s*(en(?:\$\d+)?|\w+)\s*\n\s*\}\)/g,
    (all, ns, enName) =>
      `locale.register(${ns}, {\n\t\t\t\ten: ${enName},\n\t\t\t\tru: ${enName}\n\t\t\t})`
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*\n\s*en:\s*(en(?:\$\d+)?|\w+)\s*,\s*\n\s*zh:\s*\w+\s*\n\s*\}\)/g,
    (all, ns, enName) =>
      `locale.register(${ns}, {\n\t\t\t\ten: ${enName},\n\t\t\t\tru: ${enName}\n\t\t\t})`
  );

  // one-line named
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*zh:\s*\w+\s*,\s*en:\s*(\w+)\s*\}\)/g,
    (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName} })`
  );
  s = s.replace(
    /locale\.register\(([^,]+),\s*\{\s*en:\s*(\w+)\s*,\s*zh:\s*\w+\s*\}\)/g,
    (all, ns, enName) => `locale.register(${ns}, { en: ${enName}, ru: ${enName} })`
  );

  // Guard: never leave bare `, ru }` / `{ en, ru }`
  if (/locale\.register\([^)]*\{\s*en\s*,\s*ru\s*\}/.test(s)) {
    s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*ru\s*\}/g, "locale.register($1, { en, ru: en }");
  }
  return s;
}

for (const pkg of pkgs) {
  const cleanPath = path.join(TMP, pkg, "lib/client.js");
  if (!fs.existsSync(cleanPath)) {
    console.log("missing clean", pkg);
    continue;
  }
  let fixed = softAddRuAlias(fs.readFileSync(cleanPath, "utf8"));
  // ensure no bare ru shorthand remains
  if (/\{\s*en\s*,\s*ru\s*\}/.test(fixed)) {
    console.log("WARN bare ru still in", pkg);
  }
  for (const tree of TREES) {
    const dest = path.join(tree, pkg, "lib/client.js");
    fs.writeFileSync(dest, fixed);
    const r = spawnSync(process.execPath, ["--check", dest], { encoding: "utf8" });
    console.log(tree.includes("runtime") ? "runtime" : "dist", pkg, r.status === 0 ? "ok" : r.stderr.slice(0, 160));
  }
}

// Also fix ANY other client that still has bare { en, ru } without const ru
for (const tree of TREES) {
  for (const name of fs.readdirSync(tree)) {
    if (!name.startsWith("dsh-client")) continue;
    const p = path.join(tree, name, "lib/client.js");
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, "utf8");
    if (!/\{\s*en\s*,\s*ru\s*\}/.test(s)) continue;
    if (/\bconst ru\s*=/.test(s) || /\bconst ruDict\s*=/.test(s)) continue;
    const before = s;
    s = s.replace(/locale\.register\(([^,]+),\s*\{\s*en\s*,\s*ru\s*\}/g, "locale.register($1, { en, ru: en }");
    s = s.replace(/locale\.register\(([^,]+),\s*\{\s*\n\s*en,\s*\n\s*ru\s*\n\s*\}/g, "locale.register($1, {\n\t\t\t\ten,\n\t\t\t\tru: en\n\t\t\t}");
    if (s !== before) {
      fs.writeFileSync(p, s);
      console.log("fixed bare ru", tree.includes("runtime") ? "runtime" : "dist", name);
    }
  }
}
