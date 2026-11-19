import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = "C:/Beam-Agent";
const dists = [
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist",
];

for (const distRel of dists) {
  const dist = path.join(ROOT, distRel);
  console.log("\n===", distRel, "===");
  for (const name of ["assets/index-BXV-oxvX.js", "assets/vendor-DcuzkuQH.js"]) {
    const f = path.join(dist, name);
    try {
      execFileSync("node", ["--check", f], { stdio: ["ignore", "pipe", "pipe"] });
      console.log("OK", name);
    } catch (e) {
      console.log("FAIL", name, String(e.stderr || e.message).slice(0, 400));
    }
  }
  const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  const re = /<script(?![^>]*\btype=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let i = 0;
  while ((m = re.exec(html))) {
    const code = m[1].trim();
    if (!code) continue;
    i++;
    const id = (m[0].match(/\bid=["']([^"']+)["']/) || [])[1] || "anon";
    const tmp = path.join(ROOT, `_tmp_chk_${i}.js`);
    fs.writeFileSync(tmp, code);
    try {
      execFileSync("node", ["--check", tmp], { stdio: ["ignore", "pipe", "pipe"] });
      console.log("OK inline", i, id, code.length);
    } catch (e) {
      console.log("FAIL inline", i, id);
      console.log(String(e.stderr || e.message).slice(0, 600));
    }
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}
