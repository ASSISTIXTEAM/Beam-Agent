import fs from "fs";
const html = fs.readFileSync(
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "utf8",
);
let idx = 0;
let count = 0;
while ((idx = html.indexOf('setAttribute("data-beam-icon"', idx)) >= 0 && count < 20) {
  console.log("====", idx, "====");
  console.log(html.slice(Math.max(0, idx - 300), idx + 200));
  idx += 20;
  count++;
}
console.log("total setters scanned", count);

// Find any code that walks children and copies icon attrs
for (const needle of [
  "querySelectorAll('*')",
  "childNodes",
  "data-beam-icon",
  "newSession",
  "beam-icon-host",
]) {
  let n = 0;
  let i = 0;
  while ((i = html.indexOf(needle, i)) >= 0) {
    n++;
    i += needle.length;
  }
  console.log(needle, "count", n);
}

// Look for CSS that targets class*=newSession without svg
const css = fs.readFileSync(
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "utf8",
);
const m = css.match(/\[class\*="newSession"\][^{]*\{[^}]+\}/g) || [];
console.log("newSession CSS rules", m.length);
for (const r of m.slice(0, 20)) console.log(r);
