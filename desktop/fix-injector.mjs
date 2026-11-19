import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Beam-Agent";
const WEB = path.join(
  ROOT,
  "dist/Beam-Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist"
);
const ASSETS = path.join(WEB, "assets");
const logoSvg = fs.readFileSync(path.join(ROOT, "logo.svg"), "utf8");
const wordmarkSvg = fs.readFileSync(path.join(ROOT, "logo-beam-agent.svg"), "utf8");
const toCC = (s) => s.replaceAll('fill="#00B3BC"', 'fill="currentColor"');
const dataUri = (s) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(toCC(s));
const LOGO = dataUri(logoSvg);
const WORD = dataUri(wordmarkSvg);

const CLEAN = path.join(
  ROOT,
  "_tmp_app/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html"
);
fs.copyFileSync(CLEAN, path.join(WEB, "index.html"));

// Tighten CSS — only brand chrome, never generic icons
const css = `/* BEAM AGENT — visual system (brand only) */
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

/* Sidebar brand row only */
[class*="logoRow"] svg {
  width: 28px !important;
  height: 29px !important;
  color: var(--beam) !important;
  background: currentColor !important;
  -webkit-mask: url("${LOGO}") center / contain no-repeat !important;
  mask: url("${LOGO}") center / contain no-repeat !important;
}
[class*="logoRow"] svg * { opacity: 0 !important; }

/* Boot wordmark */
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

  // ONLY DeepSeek brand wordmark canvases — never UI icons
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
</script>
`;

html = html.replace("</head>", inject + "\n</head>");
fs.writeFileSync(path.join(WEB, "index.html"), html);
console.log("injector+css tightened");
