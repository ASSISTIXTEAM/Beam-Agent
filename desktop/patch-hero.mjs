import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Alexa/OneDrive/Documents/Beam Agent";
const logo = fs
  .readFileSync(path.join(ROOT, "logo.svg"), "utf8")
  .replaceAll('fill="#00B3BC"', 'fill="currentColor"');
const LOGO =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(logo);

const p = path.join(
  ROOT,
  "dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js"
);
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf("function HeroFish({ hovering }) {");
const end = s.indexOf(
  "function HeroShell({ t, renderSlot, children }) {",
  start
);
if (start < 0 || end < 0) throw new Error("HeroFish block not found");

const replacement = `function HeroFish({ hovering }) {
\t\t\treturn (0, react_jsx_runtime.jsx)("img", {
\t\t\t\tclassName: HeroShell_module_css_default.fish,
\t\t\t\tsrc: ${JSON.stringify(LOGO)},
\t\t\t\talt: "Beam",
\t\t\t\twidth: 34,
\t\t\t\theight: 35,
\t\t\t\tstyle: {
\t\t\t\t\tdisplay: "block",
\t\t\t\t\ttransform: hovering ? "translateY(-2px) scale(1.04)" : "none",
\t\t\t\t\ttransition: "transform .25s ease",
\t\t\t\t\tfilter: "drop-shadow(0 0 10px rgba(0,179,188,.35))"
\t\t\t\t}
\t\t\t});
\t\t}
\t\t`;

s = s.slice(0, start) + replacement + s.slice(end);
s = s.split("Into the Unknown").join("Build with Beam");
// Do NOT blanket-replace DeepSeek — that previously broke the module graph.
fs.writeFileSync(p, s);
console.log("hero patched safely");
