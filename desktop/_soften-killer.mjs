import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const paths = [
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
].map((p) => path.join(ROOT, p));

const killer = `<script id="beam-boot-hidden-killer">
(() => {
  if (window.__beamBootHiddenKiller) return;
  window.__beamBootHiddenKiller = true;
  const kill = () => {
    for (const el of document.querySelectorAll('[data-dsh-boot][hidden], [data-beam-boot][hidden], [class*="_boot_"][hidden]')) {
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('opacity','0','important');
      el.style.setProperty('pointer-events','none','important');
    }
  };
  kill();
  new MutationObserver(kill).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden','class'] });
  setInterval(kill, 800);
})();
</script>`;

for (const p of paths) {
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, "utf8");
  h = h.replace(/<script id="beam-boot-hidden-killer">[\s\S]*?<\/script>\s*/g, "");
  if (h.includes("</body>")) h = h.replace("</body>", killer + "\n</body>");
  else h += "\n" + killer;
  fs.writeFileSync(p, h);
  console.log("soft killer", path.relative(ROOT, p));
}
