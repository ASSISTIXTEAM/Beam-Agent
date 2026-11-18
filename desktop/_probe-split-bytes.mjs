import fs from "node:fs";
import { spawnSync } from "node:child_process";

const files = {
  current: "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  tmp: "_tmp_app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
};

for (const [name, p] of Object.entries(files)) {
  const buf = fs.readFileSync(p);
  const s = buf.toString("utf8");
  const i = s.indexOf("e.split(/(");
  console.log("\n==", name, "bytes", buf.length);
  console.log("idx", i);
  console.log("hex", buf.subarray(i, i + 20).toString("hex"));
  console.log("json", JSON.stringify(s.slice(i, i + 30)));
  const r = spawnSync(process.execPath, ["--check", p], { encoding: "utf8" });
  console.log("check", r.status, (r.stderr || "").slice(0, 200));
  // count @assistix vs @deepseek-ai
  console.log(
    "assistix",
    (s.match(/@assistix\//g) || []).length,
    "deepseek",
    (s.match(/@deepseek-ai\//g) || []).length,
    "beam-app",
    (s.match(/beam-app:\/\//g) || []).length,
    "dsh-app",
    (s.match(/dsh-app:\/\//g) || []).length,
  );
}
