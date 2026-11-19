/**
 * Total Beam visual rebrand — fix fish path quote bug, CSS, brand slots, hero.
 * Never smash @deepseek-ai package ids.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "dist", "Beam-Agent", "resources", "app");
const WEB = path.join(
  APP,
  "dsh",
  "node_modules",
  "@deepseek-ai",
  "dsh-web-frontend",
  "dist"
);
const ASSETS = path.join(WEB, "assets");
const CLEAN = path.join(
  ROOT,
  "_tmp_app",
  "dsh",
  "node_modules",
  "@deepseek-ai"
);

const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const wordmarkSvg = fs.readFileSync(
  path.join(ROOT, "logo-beam-agent.svg"),
  "utf8"
);
const toCC = (s) => s.replaceAll('fill="#00B3BC"', 'fill="currentColor"');
const dataUri = (s) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(toCC(s));
const LOGO = dataUri(logoSvg);
const WORD = dataUri(wordmarkSvg);

const BEAM_BODY =
  "M738.178 118.454L1033.91 630.64C1125.1 788.578 1011.11 986 828.727 986H237.273C54.8922 986 -59.0957 788.578 32.0947 630.64L327.822 118.453C419.012 -39.4846 646.988 -39.4844 738.178 118.454ZM663.389 373.889C663.389 301.601 604.788 243 532.5 243C460.212 243 401.611 301.601 401.611 373.889C401.611 446.177 460.212 504.778 532.5 504.778C604.788 504.778 663.389 446.177 663.389 373.889ZM842 731.75C842 644.075 765.142 573 670.333 573H395.667C300.858 573 224 644.075 224 731.75C224 784.355 270.115 827 327 827H739C795.885 827 842 784.355 842 731.75Z";

function safeReplaceUserStrings(text) {
  const guards = [];
  text = text.replace(/@deepseek-ai\/[A-Za-z0-9_./@+-]+/g, (m) => {
    const key = `__BEAM_GUARD_${guards.length}__`;
    guards.push(m);
    return key;
  });
  text = text.replace(/deepseek-ai/g, (m) => {
    const key = `__BEAM_GUARD_${guards.length}__`;
    guards.push(m);
    return key;
  });
  const pairs = [
    ["DeepSeek Harness", "Beam Agent"],
    ["DeepSeek Account", "ASSISTIX ID"],
    ["Sign in with DeepSeek", "Sign in with ASSISTIX ID"],
    ["Sign in to DeepSeek", "Sign in with ASSISTIX ID"],
    ["About DeepSeek", "About Beam"],
    ["platform.deepseek.com", "id.assistix.org"],
    ["harness.deepseek.com", "agent.assistix.org"],
    ["download.deepseek.com", "agent.assistix.org"],
    ["DeepSeek", "Beam"],
  ];
  for (const [a, b] of pairs) text = text.split(a).join(b);
  for (let i = 0; i < guards.length; i++) {
    text = text.split(`__BEAM_GUARD_${i}__`).join(guards[i]);
  }
  return text;
}

function restoreIfExists(rel) {
  const src = path.join(CLEAN, rel);
  const dest = path.join(APP, "dsh", "node_modules", "@deepseek-ai", rel);
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dest))) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

console.log("1) Restore clean frontend + brand packages");
restoreIfExists("dsh-web-frontend/dist/assets/index-BXV-oxvX.js");
restoreIfExists("dsh-web-frontend/dist/index.html");
restoreIfExists("dsh-web-frontend/dist/manifest.webmanifest");
restoreIfExists("dsh-client-ui-brand-official/lib/client.js");
restoreIfExists("dsh-client-ui-conversation/lib/client.js");

console.log("2) Patch index JS fish (correct quote) + safe strings");
const indexJs = path.join(ASSETS, "index-BXV-oxvX.js");
let js = fs.readFileSync(indexJs, "utf8");
const fishStart = js.indexOf("M22.9168 1.43018");
if (fishStart < 0) throw new Error("fish path missing");
// Path is a JS string — delimiter is the char immediately before the path
const quote = js[fishStart - 1];
if (quote !== '"' && quote !== "'") {
  throw new Error("unexpected quote before fish path: " + JSON.stringify(quote));
}
const fishEnd = js.indexOf(quote, fishStart);
if (fishEnd < 0) throw new Error("closing quote not found");
console.log("  fish quote", quote, "len", fishEnd - fishStart);
js = js.slice(0, fishStart) + BEAM_BODY + js.slice(fishEnd);
js = js.replaceAll("{width:23.16,height:17.04}", "{width:1066,height:1107}");
js = js.replaceAll("width:23.16,height:17.04", "width:1066,height:1107");
js = js.replaceAll("0 0 23.16 17.04", "0 0 1066 1107");
js = safeReplaceUserStrings(js);
fs.writeFileSync(indexJs, js);
if (!js.includes(BEAM_BODY.slice(0, 40))) throw new Error("beam body missing after patch");
if (js.includes("M22.9168 1.43018")) throw new Error("old fish still present");
console.log("  index JS OK, size", js.length);

console.log("3) Nuclear CSS override");
const css = `/* BEAM AGENT — total visual system */
:root {
  --beam: #00B3BC;
  --beam-2: #2dd4bf;
  --beam-3: #0d9488;
  --beam-bg: #05100f;
  --beam-surface: #0b1a18;
  --beam-elev: #10211f;
  --beam-line: #1f3d38;
  --beam-ink: #eaf5f3;

  --dsw-alias-brand-primary: var(--beam) !important;
  --dsw-alias-button-primary-fill: var(--beam) !important;
  --dsw-alias-button-primary-hover: var(--beam-3) !important;
  --dsw-alias-state-business-primary: var(--beam) !important;
  --dsw-alias-link: var(--beam-2) !important;
  --dsw-focus-ring-color: var(--beam) !important;
  --dsw-static-deepseek-500: var(--beam) !important;
  --dsw-static-deepseek-450: var(--beam-2) !important;
  --dsw-static-deepseek-400: var(--beam-2) !important;
  --dsw-static-deepseek-350: #5eead4 !important;
  --dsw-static-deepseek-300: #99f6e4 !important;
}
html, body, #root {
  background:
    radial-gradient(1100px 620px at -5% -15%, rgba(0,179,188,.22), transparent 55%),
    radial-gradient(900px 520px at 110% 0%, rgba(45,212,191,.10), transparent 50%),
    var(--beam-bg) !important;
  color: var(--beam-ink) !important;
}
body[data-ds-dark-theme], :root[data-theme="dark"], html.dark {
  --dsw-alias-bg-base: var(--beam-bg) !important;
  --dsw-alias-bg-layer-1: var(--beam-surface) !important;
  --dsw-alias-bg-layer-2: var(--beam-elev) !important;
  --dsw-alias-bg-layer-3: #142b28 !important;
  --dsw-alias-bg-layer-4: #1a3531 !important;
  --dsw-alias-bg-module-platform: var(--beam-surface) !important;
  --dsw-alias-border-l1: var(--beam-line) !important;
  --dsw-alias-border-l2: #27504a !important;
  --dsw-alias-border-l3: #2f5f58 !important;
  --dsw-alias-border-l4: #3a736a !important;
  --dsw-alias-label-primary: var(--beam-ink) !important;
  --dsw-alias-label-secondary: #b3d9d3 !important;
  --dsw-alias-label-tertiary: #8fbab4 !important;
  --dsw-alias-markdown-code-block: var(--beam-surface) !important;
  --dsw-alias-markdown-code-block-banner: var(--beam-elev) !important;
  --dsw-alias-interactive-bg-hover: rgba(0,179,188,.12) !important;
  --dsw-menu-surface-fill: rgba(11,26,24,.92) !important;
}

/* Sidebar brand row only — never generic UI icons */
[class*="logoRow"] svg {
  width: 28px !important;
  height: 29px !important;
  color: var(--beam) !important;
  background: currentColor !important;
  -webkit-mask: url("${LOGO}") center / contain no-repeat !important;
  mask: url("${LOGO}") center / contain no-repeat !important;
}
[class*="logoRow"] svg * { opacity: 0 !important; }

[class*="_wordmark_"] {
  width: 240px !important;
  height: 40px !important;
  background: url("${WORD}") center / contain no-repeat !important;
  color: transparent !important;
  font-size: 0 !important;
}

[class*="_primary_"], button[data-variant="primary"] {
  background: linear-gradient(135deg, #2dd4bf, #00B3BC 55%, #0f766e) !important;
  color: #042f2e !important;
  border: none !important;
}
::selection { background: rgba(45,212,191,.35) !important; }
:focus-visible { outline-color: var(--beam) !important; }
`;
fs.writeFileSync(path.join(ASSETS, "beam-override.css"), css);

console.log("4) index.html injector (debounced, wordmarks only)");
let html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
html = html.replace(/<title>[^<]*<\/title>/, "<title>Beam Agent</title>");
html = html.replaceAll("DeepSeek Harness", "Beam Agent");
const inject = `
<link rel="stylesheet" href="./assets/beam-override.css">
<script>
(() => {
  const WORD = ${JSON.stringify(WORD)};
  let scheduled = false;
  let running = false;
  const rewriteText = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) {
      const v = n.nodeValue;
      if (!v || !/DeepSeek|Harness/i.test(v)) continue;
      n.nodeValue = v
        .replace(/DeepSeek Harness/g, "Beam Agent")
        .replace(/DeepSeek Account/g, "ASSISTIX ID")
        .replace(/Sign in with DeepSeek/g, "Sign in with ASSISTIX ID")
        .replace(/DeepSeek/g, "Beam");
    }
  };
  const rewriteWordmarks = (root) => {
    if (!root.querySelectorAll) return;
    for (const svg of [...root.querySelectorAll("svg")]) {
      if (svg.dataset.beamWord === "1") continue;
      const vb = svg.getAttribute("viewBox") || "";
      if (!(vb.includes("182 24") || vb.includes("156 24"))) continue;
      const img = new Image();
      img.src = WORD;
      img.alt = "Beam Agent";
      img.dataset.beamWord = "1";
      img.style.height = (svg.getAttribute("height") || "24") + "px";
      img.style.width = "auto";
      img.style.display = "inline-block";
      img.style.verticalAlign = "middle";
      svg.replaceWith(img);
    }
  };
  const run = () => {
    if (running) return;
    running = true;
    try {
      document.title = "Beam Agent";
      const root = document.body || document.documentElement;
      if (!root) return;
      rewriteText(root);
      rewriteWordmarks(root);
    } finally {
      running = false;
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  };
  const start = () => {
    run();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>`;
html = html.replace(
  /<link rel="stylesheet" href="\.\/assets\/beam-override\.css">[\s\S]*?<\/script>\s*/g,
  ""
);
html = html.replace("</head>", inject + "\n</head>");
fs.writeFileSync(path.join(WEB, "index.html"), html);
fs.writeFileSync(path.join(WEB, "favicon.svg"), logoSvg);
fs.writeFileSync(path.join(WEB, "favicon-dark.svg"), logoSvg);

const manifest = path.join(WEB, "manifest.webmanifest");
if (fs.existsSync(manifest)) {
  fs.writeFileSync(
    manifest,
    safeReplaceUserStrings(fs.readFileSync(manifest, "utf8"))
  );
}

console.log("5) brand-official → Beam imgs");
const brandClient = path.join(
  APP,
  "dsh",
  "node_modules",
  "@deepseek-ai",
  "dsh-client-ui-brand-official",
  "lib",
  "client.js"
);
{
  let s = fs.readFileSync(brandClient, "utf8");
  s = s.replace(
    'return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FishLogo, { size });',
    `return (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(LOGO)}, alt: "Beam", width: size, height: Math.round(size * 1.038), style: { display: "block" } });`
  );
  s = s.replace(
    'return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.BrandWordmark, { includeMark: false });',
    `return (0, react_jsx_runtime.jsx)("img", { src: ${JSON.stringify(WORD)}, alt: "Beam Agent", style: { height: 24, width: "auto", display: "block" } });`
  );
  fs.writeFileSync(brandClient, s);
  console.log("  brand-official", !s.includes("FishLogo"), s.includes('"img"'));
}

console.log("6) HeroFish → Beam img");
const convClient = path.join(
  APP,
  "dsh",
  "node_modules",
  "@deepseek-ai",
  "dsh-client-ui-conversation",
  "lib",
  "client.js"
);
{
  let s = fs.readFileSync(convClient, "utf8");
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
  s = safeReplaceUserStrings(s);
  fs.writeFileSync(convClient, s);
  console.log("  hero patched");
}

console.log("7) Shell / icons / welcome");
const welcome = path.join(APP, "renderer", "assets", "welcome-brand.svg");
if (fs.existsSync(path.dirname(welcome))) {
  fs.writeFileSync(welcome, wordmarkSvg);
}
fs.writeFileSync(path.join(ROOT, "dist", "Beam-Agent", "resources", "icon.svg"), logoSvg);

const mainJs = path.join(APP, "lib", "main.js");
if (fs.existsSync(mainJs)) {
  let main = fs.readFileSync(mainJs, "utf8");
  main = main.split("DeepSeek Harness").join("Beam Agent");
  fs.writeFileSync(mainJs, main);
}

// Patch CSS color tokens in frontend asset CSS bundles
for (const f of fs.readdirSync(ASSETS)) {
  if (!f.endsWith(".css") || f === "beam-override.css") continue;
  const p = path.join(ASSETS, f);
  let c = fs.readFileSync(p, "utf8");
  const before = c;
  // Common DeepSeek blue → Beam teal (hex used in theme tokens)
  c = c.replaceAll("#4D6BFE", "#00B3BC");
  c = c.replaceAll("#4d6bfe", "#00B3BC");
  c = c.replaceAll("#3D5CFE", "#0d9488");
  c = c.replaceAll("#5B7CFF", "#2dd4bf");
  if (c !== before) {
    fs.writeFileSync(p, c);
    console.log("  css tokens", f);
  }
}

console.log("✓ Total visual rebrand done");
