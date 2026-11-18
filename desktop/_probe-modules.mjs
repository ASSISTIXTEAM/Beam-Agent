import fs from "node:fs";
const s = fs.readFileSync(
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "utf8",
);
console.log({
  deepseek: (s.match(/@deepseek-ai\//g) || []).length,
  assistix: (s.match(/@assistix\//g) || []).length,
  dshClient: (s.match(/dsh-client/g) || []).length,
  beamClient: (s.match(/beam-client/g) || []).length,
  dshPackage: (s.match(/@assistix\/dsh-/g) || []).length,
  cordisHits: [...s.matchAll(/@assistix\/[a-z0-9-]*cordis[a-z0-9-]*/g)].slice(0, 10).map((m) => m[0]),
});
const i = s.indexOf("function OZ");
const j = s.indexOf("staticModules");
console.log("OZ", i, "staticModules", j);
console.log(s.slice(Math.max(0, j), j + 500));
const main = fs.readFileSync("runtime/app/lib/main.js", "utf8");
console.log("noflicker", main.includes("beam-no-flicker-remount"));
