import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = "C:/Beam-Agent";
const paths = [
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
];

for (const rel of paths) {
  const p = path.join(ROOT, rel);
  const s = fs.readFileSync(p, "utf8");
  console.log("\n==", rel, "len", s.length);
  for (const needle of [
    "beamScrubDocumentTitle",
    "beamTagIcons",
    "beamFixBrandChrome",
    "BEAM selection lock",
    "BEAM custom icons",
    "wtg9ga_brandMark",
    "Задачи автоматизации",
    "Собрано в Beam",
    "DeepSeek Harness",
    "user-select: none",
    "beam-icons/bold/plus.svg",
  ]) {
    console.log(" ", needle, s.includes(needle));
  }
}

// Syntax-ish: extract script and check balance
const html = fs.readFileSync(path.join(ROOT, paths[0]), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (m) {
  const tmp = path.join(ROOT, "desktop/_tmp_index_inject.js");
  fs.writeFileSync(tmp, m[1]);
  const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  console.log("\ninjector syntax:", r.status === 0 ? "OK" : r.stderr);
}

// Remaining EN in key RU dicts
const side = path.join(
  ROOT,
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js"
);
const sideS = fs.readFileSync(side, "utf8");
const ru = sideS.match(/\/\/ #region beam-ru([\s\S]*?)\/\/ #endregion beam-ru/);
console.log("\nsidebar beam-ru:\n", ru && ru[1]);

const icons = path.join(
  ROOT,
  "runtime/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-icons"
);
console.log(
  "\nicons bold count",
  fs.readdirSync(path.join(icons, "bold")).length,
  "fill",
  fs.readdirSync(path.join(icons, "fill")).length
);

// Grep remaining user-facing English in conversation/schedule/model
for (const pkg of [
  "dsh-client-ui-conversation",
  "dsh-client-ui-schedule",
  "dsh-client-ui-model-selection",
  "dsh-client-ui-permission-presets",
  "dsh-client-ui-agent-preset",
  "dsh-client-ui-trajectory",
]) {
  const f = path.join(ROOT, "runtime/app/dsh/node_modules/@deepseek-ai", pkg, "lib/client.js");
  if (!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, "utf8");
  const hits = [];
  for (const en of [
    "Automation tasks",
    "Standard mode",
    "Select model",
    "Workspace Write",
    "Message or run a task",
    '"Chat"',
    '"Trajectory"',
    "Build with Beam",
    "Preview",
    "DeepSeek Harness",
    "New Session",
  ]) {
    if (s.includes(en)) hits.push(en);
  }
  console.log(pkg, hits.join(" | ") || "clean-ish");
}
