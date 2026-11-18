import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
].map((p) => path.join(ROOT, p));

for (const p of files) {
  const h = fs.readFileSync(p, "utf8");
  const scripts = [...h.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  let bad = 0;
  for (const m of scripts) {
    const body = m[1];
    if (!body.trim()) continue;
    const tmp = path.join(ROOT, "desktop", "_tmp_html_script_check.js");
    fs.writeFileSync(tmp, body);
    const r = spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
    if (r.status !== 0) {
      bad++;
      console.log("BAD", path.relative(ROOT, p), (r.stderr || "").slice(0, 240));
    }
  }
  try {
    fs.unlinkSync(path.join(ROOT, "desktop", "_tmp_html_script_check.js"));
  } catch {}
  const asset = path.join(path.dirname(p), "assets", "index-BXV-oxvX.js");
  const assetOk = fs.existsSync(asset);
  let assetParse = false;
  if (assetOk) {
    const r = spawnSync(process.execPath, ["--check", asset], { encoding: "utf8" });
    assetParse = r.status === 0;
  }
  console.log({
    file: path.relative(ROOT, p),
    inline: scripts.length,
    bad,
    hasRoot: /id=["']root["']/.test(h),
    indexRef: /index-BXV-oxvX\.js/.test(h),
    assetOk,
    assetParse,
    bytes: h.length,
  });
}
