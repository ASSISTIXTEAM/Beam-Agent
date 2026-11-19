/**
 * Inject client reporter: feedback / thumbs / Failed turns → local bridge → ASSISTIX Admin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEBS = [
  "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
  "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/index.html",
  "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html",
].map((p) => path.join(ROOT, p));

const SCRIPT = `<script id="beam-telemetry-bridge">
(() => {
  const ENDPOINT = "http://127.0.0.1:17865/assistix/telemetry";
  const send = (ev) => {
    try {
      const body = JSON.stringify({
        ...ev,
        source: "beam-agent-ui",
        app_version: "0.1.3-early-alpha",
        href: location.href,
        at: new Date().toISOString(),
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(ENDPOINT, blob);
      } else {
        fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
      }
    } catch {}
  };
  window.__beamReport = send;

  // Thumbs / feedback buttons
  document.addEventListener("click", (e) => {
    const el = e.target?.closest?.("button,[role='button']");
    if (!el) return;
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim();
    if (/thumbs up|нравится/i.test(label)) send({ kind: "thumbs_up", subject: "Thumbs up", message: label });
    else if (/thumbs down|не нравится/i.test(label)) send({ kind: "thumbs_down", subject: "Thumbs down", message: label });
    else if (/^feedback$|обратн/i.test(label) && label.length < 40) send({ kind: "feedback", subject: "Opened feedback", message: label });
  }, true);

  // Detect Failed turns in conversation
  let lastFail = "";
  const scanFails = () => {
    try {
      const nodes = document.querySelectorAll("[class*='error'],[class*='Failed'],[data-error-code]");
      for (const n of nodes) {
        const t = (n.innerText || "").trim();
        if (!t || t.length > 500) continue;
        if (!/this turn failed|could not get a model response|MODEL_UNSUPPORTED|turn failed/i.test(t)) continue;
        if (t === lastFail) continue;
        lastFail = t;
        send({ kind: "turn_failed", level: "ERROR", subject: "UI turn failed", message: t.slice(0, 800) });
      }
    } catch {}
  };
  setInterval(scanFails, 2500);
  document.addEventListener("DOMContentLoaded", scanFails);

  // Hook window errors
  window.addEventListener("error", (ev) => {
    send({ kind: "error", level: "ERROR", subject: "Renderer error", message: String(ev?.message || ev), meta: { file: ev?.filename, line: ev?.lineno } });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    send({ kind: "error", level: "ERROR", subject: "Unhandled rejection", message: String(ev?.reason?.message || ev?.reason || ev) });
  });
})();
</script>`;

for (const p of WEBS) {
  if (!fs.existsSync(p)) {
    console.log("skip", p);
    continue;
  }
  let h = fs.readFileSync(p, "utf8");
  h = h.replace(/<script id="beam-telemetry-bridge">[\s\S]*?<\/script>\s*/g, "");
  if (h.includes("</body>")) h = h.replace("</body>", SCRIPT + "\n</body>");
  else h += "\n" + SCRIPT;
  fs.writeFileSync(p, h);
  console.log("patched", path.relative(ROOT, p));
}
console.log("telemetry client injected");
