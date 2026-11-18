import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = [
  path.join(ROOT, "dist", "Beam Agent", "resources", "app"),
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam Agent", "bridge"),
  path.join(ROOT, "desktop", "bridge"),
  path.join(ROOT, "dist", "Beam Agent"),
].filter((p) => fs.existsSync(p));

const EXT = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".md",
  ".yml",
  ".yaml",
  ".txt",
  ".cmd",
  ".vbs",
  ".ts",
  ".map",
  ".webmanifest",
]);

function rewrite(s) {
  s = s.split("@deepseek-ai/dsh-").join("@assistix/beam-");
  s = s.split("@deepseek-ai/dsh/").join("@assistix/beam/");
  s = s.split("@deepseek-ai/dsh\"").join("@assistix/beam\"");
  s = s.split("@deepseek-ai/dsh'").join("@assistix/beam'");
  s = s.split("@deepseek-ai/dsh`").join("@assistix/beam`");
  s = s.split("@deepseek-ai/dsh}").join("@assistix/beam}");
  s = s.split("@deepseek-ai/").join("@assistix/");
  s = s.split("node_modules/@deepseek-ai/").join("node_modules/@assistix/");
  s = s.split("node_modules\\\\@deepseek-ai\\\\").join("node_modules\\\\@assistix\\\\");
  s = s.split("/dsh/node_modules").join("/beam/node_modules");
  s = s.split("\\dsh\\node_modules").join("\\beam\\node_modules");
  s = s.split("/dsh/").join("/beam/");
  s = s.split("\\dsh\\").join("\\beam\\");
  s = s.replace(/,"dsh",/g, ',"beam",');
  s = s.replace(/, "dsh",/g, ', "beam",');
  s = s.replace(/'dsh'/g, "'beam'");
  s = s.replace(/"dsh"/g, '"beam"');
  s = s.split("dsh-app").join("beam-app");
  s = s.split("dsh-platform").join("beam-platform");
  s = s.split("dsh-desktop").join("beam-desktop");
  s = s.split("deepseek-official").join("assistix-official");
  s = s.split("deepseek-account").join("assistix-account");
  s = s.split("DEEPSEEK_API_KEY").join("BEAM_API_KEY");
  s = s.split("DEEPSEEK_BASE_URL").join("BEAM_BASE_URL");
  s = s.replace(/\bDeepSeek Harness\b/g, "Beam Agent");
  s = s.replace(/\bDeepSeek Account\b/g, "ASSISTIX ID");
  s = s.replace(/\bDeepSeek\b/g, "ASSISTIX");
  s = s.replace(/\bHarness\b/g, "Beam Agent");
  // package name fields without scope
  s = s.replace(/"name"\s*:\s*"dsh-/g, '"name": "beam-');
  s = s.replace(/"name"\s*:\s*"dsh"/g, '"name": "beam"');
  // llm package folder was dsh-llm-deepseek → beam-llm-assistix
  s = s.split("@assistix/beam-llm-deepseek").join("@assistix/beam-llm-assistix");
  s = s.split("beam-llm-deepseek").join("beam-llm-assistix");
  s = s.split("beam-web-search-deepseek").join("beam-web-search-assistix");
  s = s.split("beam-web-deepseek-api").join("beam-web-assistix-api");
  s = s.split("beam-session-log-deepseek").join("beam-session-log-assistix");
  return s;
}

let patched = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === ".git") continue;
      walk(p);
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!EXT.has(ext) && ent.name !== "version") continue;
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.size > 12_000_000) continue;
    let s;
    try {
      s = fs.readFileSync(p, "utf8");
    } catch {
      continue;
    }
    if (!/deepseek|DeepSeek|Harness|@deepseek-ai|DEEPSEEK_|dsh-app|dsh-platform|\/dsh\/|\\dsh\\|["']dsh["']/i.test(s))
      continue;
    const n = rewrite(s);
    if (n !== s) {
      fs.writeFileSync(p, n);
      patched++;
    }
  }
}

for (const r of roots) {
  console.log("walk", r);
  walk(r);
}
console.log(JSON.stringify({ patched }, null, 2));
