import fs from "node:fs";
const p =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.js";
let s = fs.readFileSync(p, "utf8");
console.log("includes zh: zh$", s.includes("zh: zh$"));
const i = s.indexOf('locale.register("documentMarkdown"');
console.log(JSON.stringify(s.slice(i, i + 120)));
const re =
  /locale\.register\(([^,]+),\s*\{\s*zh:\s*(\w+)\s*,\s*en:\s*(\w+)\s*\}\)/gs;
console.log("matches", [...s.matchAll(re)].length);
s = s.replace(re, "locale.register($1, { en: $3, ru: $3 })");
const re2 =
  /locale\.register\(([^,]+),\s*\{\s*en:\s*(\w+)\s*,\s*zh:\s*(\w+)\s*\}\)/gs;
s = s.replace(re2, "locale.register($1, { en: $2, ru: $2 })");
fs.writeFileSync(p, s);
console.log("after matches", [...fs.readFileSync(p, "utf8").matchAll(re)].length);
console.log("sample", fs.readFileSync(p, "utf8").slice(i, i + 100));
