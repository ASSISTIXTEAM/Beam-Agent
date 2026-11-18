import fs from "node:fs";
const s = fs.readFileSync(
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "utf8",
);
const needle = 'case"script-src":await t(r.src)';
const i = s.indexOf(needle);
console.log("at", i);
console.log(s.slice(i - 1800, i + 250));
