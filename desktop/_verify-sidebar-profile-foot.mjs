import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const htmlPath = path.join(
  ROOT,
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html"
);
const cssPath = path.join(
  ROOT,
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css"
);

const h = fs.readFileSync(htmlPath, "utf8");
const scripts = [...h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0;
for (const s of scripts) {
  if (!s.includes("renderSide") && !s.includes("beam-side-limits")) continue;
  try {
    new Function(s);
    parsed++;
    console.log("parse ok bytes", s.length);
  } catch (e) {
    console.error("PARSE FAIL", e.message);
    // show nearby line
    const m = String(e.stack || "");
    console.error(m.slice(0, 400));
    process.exit(1);
  }
}
if (!parsed) {
  console.error("no injector script found");
  process.exit(1);
}

const checks = [
  'data-act="profile"',
  'data-act="settings"',
  'data-act="limits"',
  "bsl-gear",
  "bsl-gear-ico",
  "beam-profile-modal",
  "beam-limits-modal",
  "hideNativeMoreControl",
  "openAppSettings",
  "openProfileModal",
  "openLimitsModal",
  "bsl-foot-row",
  "profileTitle",
  "limitsTitle",
  "bsl-label",
  'data-model="',
];
for (const c of checks) console.log(c, h.includes(c));

const renderChunk = h.match(/const renderSide = \(data\) => \{[\s\S]*?const enhanceLimitsPage/)?.[0] || "";
console.log("no Update in foot render", !/bsl-update|>\s*Update\s*<|"Update"/.test(renderChunk));
console.log("has logout X in renderSide", /bsl-logout/.test(renderChunk));
console.log("has gear in renderSide", /bsl-gear/.test(renderChunk));
console.log("has gear ico", /bsl-gear-ico/.test(renderChunk) || h.includes("bsl-gear-ico"));
console.log("has profile act", /data-act="profile"/.test(renderChunk));
console.log("has limits act", /data-act="limits"/.test(renderChunk));
console.log("render has bsl-label", /bsl-label/.test(renderChunk));
console.log("render has no email line", !/bsl-email/.test(renderChunk));
console.log("profile has bpm-rings", /bpm-rings/.test(h));
console.log("gearSvg count", (h.match(/const gearSvg = /g) || []).length);

const css = fs.readFileSync(cssPath, "utf8");
console.log("css marker", css.includes("BEAM sidebar profile foot"));
console.log("css compact foot", css.includes("Compact foot"));
console.log("css hide email", /#beam-side-limits \.bsl-email[\s\S]*?display:\s*none\s*!important/.test(css));
console.log("css label visible", css.includes("Model names MUST stay visible") && css.includes("#b7d0cb"));
console.log("css early rings labels", css.includes("Three rings + Tide / Flare / Pine"));
console.log("css gear ico mask", css.includes("beam-icons/bold/settings.svg") && css.includes("bsl-gear-ico"));
console.log("css gear", css.includes(".bsl-gear"));
console.log("css hide more", css.includes("_5Qcc8a_root"));
console.log("css profile modal", css.includes("#beam-profile-modal"));
console.log("css limits modal", css.includes("#beam-limits-modal"));
console.log("css no teal DIY panel border", !/#beam-profile-modal \.bpm-panel \{[\s\S]*?border:\s*1px solid rgba\(0,\s*179,\s*188/.test(css));

const icons = path.join(
  ROOT,
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-icons/bold/settings.svg"
);
console.log("pack settings icon", fs.existsSync(icons) && fs.readFileSync(icons, "utf8").includes("currentColor"));
