import fs from "node:fs";
import path from "node:path";

const DSH =
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai";

const re =
  /locale\.register\(([^,]+),\s*\{\s*zh:\s*(\w+)\s*,\s*en:\s*(\w+)\s*\}\)/gs;
const re2 =
  /locale\.register\(([^,]+),\s*\{\s*en:\s*(\w+)\s*,\s*zh:\s*(\w+)\s*\}\)/gs;

let files = 0;
let hits = 0;
for (const name of fs.readdirSync(DSH)) {
  if (!name.startsWith("dsh-client")) continue;
  const p = path.join(DSH, name, "lib", "client.js");
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(re, "locale.register($1, { en: $3, ru: $3 })");
  s = s.replace(re2, "locale.register($1, { en: $2, ru: $2 })");
  if (s !== before) {
    fs.writeFileSync(p, s);
    files++;
    const c = (before.match(re) || []).length + (before.match(re2) || []).length;
    hits += c;
    console.log(name, "hits~");
  }
}
console.log("files", files, "approx hits", hits);

// Ensure schedule manager has const ru
{
  const p = path.join(DSH, "dsh-client-ui-schedule/lib/client.js");
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("{ en, ru }") && !/\bconst ru\s*=/.test(s)) {
    // find manager en dict - usually `const en = {` near manager
    const m = s.indexOf('locale.register(MANAGER_NS, { en, ru })');
    const enIdx = s.lastIndexOf("const en = {", m);
    if (enIdx >= 0) {
      // just alias: const ru = en; before apply
      s = s.replace(
        'locale.register(MANAGER_NS, { en, ru })',
        'locale.register(MANAGER_NS, { en, ru: en })'
      );
      fs.writeFileSync(p, s);
      console.log("schedule manager: ru alias to en");
    }
  }
}
