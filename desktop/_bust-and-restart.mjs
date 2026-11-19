import fs from "node:fs";
import { spawn } from "node:child_process";

const htmlPaths = [
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "C:/Beam-Agent/runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "C:/Beam-Agent/runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
];

const bust = "coolicons-duocolor-round-mask2";
for (const p of htmlPaths) {
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, "utf8");
  h = h.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${bust}"`
  );
  fs.writeFileSync(p, h);
  console.log("bust", p);
}
console.log("done", bust);
