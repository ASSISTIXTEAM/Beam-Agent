import fs from "node:fs";

const mains = [
  "runtime/app/lib/main.js",
  "dist/Beam Agent/resources/app/lib/main.js",
];
const htmls = [
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
];

for (const p of mains) {
  const s = fs.readFileSync(p, "utf8");
  console.log(p);
  console.log("  lock title", s.includes("BEAM_NATIVE_APP_CHROME: lock title"));
  console.log("  hide menubar", s.includes("BEAM_NATIVE_APP_CHROME: hide menubar"));
  console.log("  title option", s.includes('title: "Beam Agent"'));
  console.log("  applicationUrl", s.includes("const applicationUrl = `${SCHEME}://app/`;"));
  console.log("  SCHEME", /const SCHEME = "beam-app"/.test(s));
  console.log("  no auto-devtools", s.includes("BEAM_NATIVE_APP_CHROME: no auto-devtools"));
  console.log("  openDevTools !==0 left", (s.match(/DSH_DESKTOP_OPEN_DEVTOOLS !== "0"/g) || []).length);
}
for (const p of htmls) {
  const h = fs.readFileSync(p, "utf8");
  console.log(p);
  console.log("  title scrub", h.includes("BEAM_NATIVE_APP_CHROME: title scrub"));
  console.log("  title tag", /<title>Beam Agent<\/title>/.test(h));
  console.log("  bridge internal", h.includes('const BRIDGE = "http://127.0.0.1:17865"'));
}
