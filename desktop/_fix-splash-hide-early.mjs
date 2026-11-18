import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const htmls = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
].map((p) => path.join(ROOT, p));

const oldHide = `const hideEarly = () => {
    const el = early();
    if (el) { el.hidden = true; el.setAttribute("hidden", ""); }
  };`;

const neuHide = `const hideEarly = () => {
    const el = early();
    if (!el) return;
    el.hidden = true;
    el.setAttribute("hidden", "");
    el.removeAttribute("data-beam-boot");
    el.removeAttribute("aria-busy");
    try { el.remove(); } catch {}
  };`;

for (const f of htmls) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("el.removeAttribute(\"data-beam-boot\")")) {
    console.log("html already", path.relative(ROOT, f));
    continue;
  }
  if (!s.includes(oldHide)) {
    console.log("miss hide", path.relative(ROOT, f));
    continue;
  }
  fs.writeFileSync(f, s.split(oldHide).join(neuHide));
  console.log("html ok", path.relative(ROOT, f));
}

const mains = [
  path.join(ROOT, "runtime/app/lib/main.js"),
  path.join(ROOT, "dist/Beam Agent/resources/app/lib/main.js"),
];

const oldBoot =
  'const boot = document.querySelector("[data-dsh-boot], [data-dsh-boot-spinner], [data-beam-boot]");';
const neuBoot =
  'const boot = document.querySelector("[data-dsh-boot]:not([hidden]), [data-dsh-boot-spinner]:not([hidden]), [data-beam-boot]:not([hidden])");';

for (const f of mains) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("[data-dsh-boot]:not([hidden])")) {
    console.log("main already", path.relative(ROOT, f));
    continue;
  }
  if (!s.includes(oldBoot)) {
    console.log("miss boot sel", path.relative(ROOT, f));
    continue;
  }
  fs.writeFileSync(f, s.split(oldBoot).join(neuBoot));
  console.log("main ok", path.relative(ROOT, f));
}
