import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TREES = [
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix"),
  path.join(ROOT, "dist", "Beam Agent", "resources", "app", "beam", "node_modules", "@assistix"),
];

for (const tree of TREES) {
  const host = path.join(tree, "beam-permission-presets/lib/index.js");
  let s = fs.readFileSync(host, "utf8");
  const old = `toolCtx.effect(() => register(definition), "permissionPresets.request_elevated_access");`;
  const neu = `try { register(definition); } catch (error) { try { toolCtx.logger?.warn?.("permission: request_elevated_access tool not registered: " + (error instanceof Error ? error.message : String(error))); } catch {} }`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    fs.writeFileSync(host, s);
  }
  const r = spawnSync(process.execPath, ["--check", host], { encoding: "utf8" });
  console.log("host", path.basename(path.dirname(path.dirname(path.dirname(tree)))), r.status === 0 ? "ok" : (r.stderr || "").slice(0, 200));

  const ui = path.join(tree, "beam-client-ui-permission-presets/lib/client.js");
  let u = fs.readFileSync(ui, "utf8");
  if (u.includes('"preset.workspaceWrite": "Запись в проект"')) {
    u = u.replace('"preset.workspaceWrite": "Запись в проект"', '"preset.workspaceWrite": "工作区内修改"');
    fs.writeFileSync(ui, u);
    console.log("fixed accessZh mix");
  }
  const r3 = spawnSync(process.execPath, ["--check", ui], { encoding: "utf8" });
  console.log("ui", r3.status === 0 ? "ok" : (r3.stderr || "").slice(0, 200));
}
