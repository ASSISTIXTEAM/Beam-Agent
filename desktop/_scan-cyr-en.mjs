import fs from "node:fs";
import path from "node:path";

const root =
  "C:/Beam-Agent/runtime/app/dsh/node_modules/@deepseek-ai";
const bad = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "client.js" && p.includes("dsh-client")) {
      const s = fs.readFileSync(p, "utf8");
      const m = s.match(/const en = \{/);
      if (!m) continue;
      const start = m.index;
      const endMark = s.indexOf("// #region beam-ru", start);
      const endZh = s.indexOf("const zh", start);
      const endRu = s.indexOf("const ru", start);
      let end = start + 8000;
      for (const x of [endMark, endZh, endRu]) if (x > start && x < end) end = x;
      const en = s.slice(start, end);
      if (/[А-Яа-яЁё]/.test(en)) {
        const hit = en.match(/[А-Яа-яЁё][^"']{0,50}/);
        bad.push(path.basename(path.dirname(path.dirname(p))) + ": " + (hit?.[0] || "?"));
      }
    }
  }
}
walk(root);
console.log(bad.join("\n"));
console.log("count", bad.length);
