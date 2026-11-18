import fs from "node:fs";
const s = fs.readFileSync(
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "utf8",
);
const i = s.indexOf("UZ(");
console.log("UZ refs");
let idx = 0,
  c = 0;
while ((idx = s.indexOf("UZ(", idx)) !== -1 && c < 10) {
  console.log("---", idx, JSON.stringify(s.slice(idx, idx + 220)));
  idx += 3;
  c++;
}
// find loadScript helper near boot
const j = s.indexOf("createElement(\"script\")");
let k = 0,
  n = 0;
while ((k = s.indexOf('createElement("script")', k)) !== -1 && n < 8) {
  console.log("script@", k, JSON.stringify(s.slice(k - 80, k + 280)));
  k += 10;
  n++;
}
