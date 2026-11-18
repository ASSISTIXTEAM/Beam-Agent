import fs from "node:fs";

const html = fs.readFileSync(
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "utf8",
);
const scripts = [...html.matchAll(/<script(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => m[1],
);
const inj = scripts.filter((s) => s.includes("beamStripWorkspaceFolderTags"));
if (!inj.length) throw new Error("injector missing");
for (const s of inj) new Function(s);
console.log("injector parse ok", inj.length);