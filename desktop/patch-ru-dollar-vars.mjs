import fs from "node:fs";
import path from "node:path";

const DSH =
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai";

const re =
  /locale\.register\(([^,]+),\s*\{\s*zh:\s*([\w$]+)\s*,\s*en:\s*([\w$]+)\s*\}\)/gs;
const re2 =
  /locale\.register\(([^,]+),\s*\{\s*en:\s*([\w$]+)\s*,\s*zh:\s*([\w$]+)\s*\}\)/gs;

let files = 0;
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
    console.log("fixed", name);
  }
}
console.log("files", files);
