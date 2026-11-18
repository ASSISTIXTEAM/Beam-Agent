import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync("desktop/bridge/server.js","utf8");
const start = src.indexOf("function looksTruncated");
const marker = "\n  return false\n}";
const end = src.indexOf(marker, start) + marker.length;
const code = "function dsmlPresent(){return false}\n" + src.slice(start, end) + "\nthis.looksTruncated=looksTruncated;";
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const t = ctx.looksTruncated;
const cases = [
  ["Готово.", false],
  ["Вывод:", false],
  ["текст…", false],
  ["def foo(", true],
  ["```python\nprint(1)", true],
  ["x = ", true],
  ["arr.push(", true],
];
let ok = true;
for (const [s, exp] of cases) {
  const got = t(s);
  if (got !== exp) { console.error("FAIL", JSON.stringify(s), "got", got, "exp", exp); ok = false; }
}
if (!ok) process.exit(1);
console.log("looksTruncated OK");
