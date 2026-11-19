import fs from "node:fs";
import path from "node:path";

const p =
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html";
const h = fs.readFileSync(p, "utf8");
console.log("len", h.length);
console.log("root", /id=["']root["']/.test(h));
console.log(
  "modules",
  [...h.matchAll(/src="\.\/assets\/[^"]+"/g)].map((m) => m[0])
);
const w = h.match(/<script id="beam-splash-watchdog">([\s\S]*?)<\/script>/);
console.log("watchdog", w ? w[1].slice(0, 1500) : "none");

const assets = path.join(path.dirname(p), "assets");
for (const f of [
  "index-BXV-oxvX.js",
  "vendor-DcuzkuQH.js",
  "index-BNyAYEM7.css",
  "beam-override.css",
]) {
  const full = path.join(assets, f);
  console.log(fs.existsSync(full), f, fs.existsSync(full) ? fs.statSync(full).size : 0);
}
