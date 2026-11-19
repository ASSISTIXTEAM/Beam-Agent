import fs from "fs";
import path from "path";

const files = [
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/lib/main.js",
  "C:/Beam-Agent/runtime/app/lib/main.js",
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  // Find resolveDesktopLocale / messages blocks
  const idx = s.indexOf("function resolveDesktopLocale");
  console.log(path.basename(path.dirname(file)), "resolve at", idx);
  if (idx >= 0) {
    console.log(s.slice(idx, idx + 1200));
  }
  // Also search application: "
  const re = /application:\s*"([^"]+)"/g;
  let m;
  const hits = [];
  while ((m = re.exec(s))) hits.push({ i: m.index, v: m[1], ctx: s.slice(Math.max(0, m.index - 80), m.index + 60) });
  console.log("application hits", hits.slice(0, 10));
  const re2 = /edit:\s*"([^"]+)"/gi;
  const hits2 = [];
  while ((m = re2.exec(s))) {
    if (/messages|locale|Edit|Правка|edit:/.test(s.slice(Math.max(0, m.index - 40), m.index + 40))) {
      hits2.push({ i: m.index, v: m[1], ctx: s.slice(Math.max(0, m.index - 60), m.index + 40) });
    }
  }
  console.log("edit-ish", hits2.slice(0, 15));
}
