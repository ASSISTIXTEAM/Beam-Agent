import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CSS_PATHS = [
  "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/beam-override.css",
].map((p) => path.join(ROOT, p));

const HTML_PATHS = CSS_PATHS.map((p) =>
  p.replace(/assets[\\/]beam-override\.css$/, "index.html")
);

const FIX = `

/* ===== BEAM boot must honor hidden ===== */
[data-dsh-boot][hidden],
[data-beam-boot][hidden],
[class*="_boot_"][hidden],
#beam-early-splash[hidden] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  position: absolute !important;
  inset: auto !important;
  z-index: -1 !important;
}
`;

for (const p of CSS_PATHS) {
  if (!fs.existsSync(p)) {
    console.log("skip css", path.relative(ROOT, p));
    continue;
  }
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("BEAM boot must honor hidden")) {
    // Change display:grid !important on boot block to non-important so [hidden] can win
    s = s.replace(
      /(\/\* ===== BEAM boot splash =====[\s\S]*?#beam-early-splash \{[\s\S]*?)display:\s*grid\s*!important;/,
      "$1display: grid;"
    );
    s += FIX;
    fs.writeFileSync(p, s);
    console.log("fixed css", path.relative(ROOT, p));
  } else {
    console.log("already css", path.relative(ROOT, p));
  }
}

for (const p of HTML_PATHS) {
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, "utf8");
  h = h.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    'href="./assets/beam-override.css?v=coolforce5b"'
  );
  // Harden splash watchdog: when boot gets hidden, force-remove it
  if (!h.includes("__beamBootHiddenKiller")) {
    const killer = `<script id="beam-boot-hidden-killer">
(() => {
  if (window.__beamBootHiddenKiller) return;
  window.__beamBootHiddenKiller = true;
  const kill = () => {
    for (const el of document.querySelectorAll('[data-dsh-boot][hidden], [data-beam-boot][hidden], [class*="_boot_"][hidden]')) {
      try { el.style.setProperty('display','none','important'); el.remove(); } catch {}
    }
  };
  kill();
  new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  setInterval(kill, 1000);
})();
</script>`;
    if (h.includes("</body>")) h = h.replace("</body>", killer + "\n</body>");
    else h += "\n" + killer + "\n";
  }
  fs.writeFileSync(p, h);
  console.log("fixed html", path.relative(ROOT, p));
}
