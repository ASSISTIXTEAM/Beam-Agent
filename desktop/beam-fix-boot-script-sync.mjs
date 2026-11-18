import fs from "node:fs";

const files = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/index-BXV-oxvX.js",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BXV-oxvX.js",
];

const old =
  'const p=document.createElement("script");p.src=l,p.onload=()=>{u()},p.onerror=()=>{h(new Error(`desktop web: failed to load ${l}`))},document.head.append(p)';
const neu =
  'const p=document.createElement("script");p.async=false;/* beam-boot-script-sync */p.src=l,p.onload=()=>{u()},p.onerror=()=>{h(new Error(`desktop web: failed to load ${l}`))},document.head.append(p)';

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log("MISS", f);
    continue;
  }
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("beam-boot-script-sync")) {
    console.log("already", f);
    continue;
  }
  if (!s.includes(old)) {
    console.log("miss pattern", f);
    continue;
  }
  fs.writeFileSync(f, s.split(old).join(neu));
  console.log("patched", f);
}

const mains = ["runtime/app/lib/main.js", "dist/Beam Agent/resources/app/lib/main.js"];
const oldBoot =
  "if (boot && text.length >= 8) return { blank: false, booting: true, textLen: text.length };";
const neuBoot =
  "if (boot && text.length >= 8) { const started = Number(window.__beamBootStartedAt || (window.__beamBootStartedAt = Date.now())); if (Date.now() - started < 18000) return { blank: false, booting: true, textLen: text.length }; return { blank: true, bootingStuck: true, textLen: text.length }; }";
for (const f of mains) {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("bootingStuck")) {
    console.log("bootstuck already", f);
    continue;
  }
  if (!s.includes(oldBoot)) {
    console.log("miss boot check", f);
    continue;
  }
  fs.writeFileSync(f, s.split(oldBoot).join(neuBoot));
  console.log("bootstuck", f);
}
