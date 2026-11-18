import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "desktop/_verify-icons-v4-out");
const CACHE = "coolicons-everywhere-v4d";
const require = createRequire(import.meta.url);
const WS = require("ws");

const FRONTENDS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "C:/Users/Alexa/BeamAgent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
];

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list[0];
const ws = new WS(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params }));
});
await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
ws.on("message", (d) => {
  const m = JSON.parse(String(d));
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
});
await send("Runtime.enable");
await send("Page.enable");

const probe = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    document.querySelector('.bsl-gear')?.click();
    const themes = [...document.querySelectorAll('[role="dialog"] button')].filter((el) => {
      const t = ((el.innerText || "") + "").trim().split("\\n")[0].trim();
      return /светл|тёмн|темн|систем|light|dark|system/i.test(t);
    });
    return themes.map((el) => {
      const label = ((el.getAttribute("aria-label") || "") + "||" + (el.innerText || "")).trim();
      return {
        label,
        labelCodes: [...label].slice(0, 40).map((c) => c.charCodeAt(0)),
        cls: String(el.className||""),
        parent: String(el.parentElement?.className||"").slice(0,160),
        grand: String(el.parentElement?.parentElement?.className||"").slice(0,160),
        idx: [...(el.parentElement?.children||[])].indexOf(el),
        kids: el.parentElement?.children?.length,
        outer: el.outerHTML.slice(0, 500),
      };
    });
  })()`,
});
console.log(JSON.stringify(probe.result?.value, null, 2));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "theme-probe2.json"), JSON.stringify(probe.result?.value, null, 2));

const themes = probe.result?.value || [];
if (!themes.length) {
  console.error("No theme buttons found");
  ws.close();
  process.exit(1);
}

const parent = themes[0].parent;
const parentFrag = (parent.match(/[A-Za-z0-9_-]{6,}/g) || [parent.split(/\s+/)[0]]).sort((a,b)=>b.length-a.length)[0];
console.log("using parentFrag", parentFrag);

// Check why tagger may not run: inspect if beam-theme-tagger-v4c exists and if beamTagIcons errors
const taggerStatus = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const html = document.documentElement.innerHTML;
    return {
      hasThemeTagger: html.includes("beam-theme-tagger-v4c"),
      hasNavTagger: html.includes("beam-navcell-tagger-v4b"),
      hasSkipV4: html.includes("beam-skip-gauge-v4"),
    };
  })()`,
});
console.log("taggerStatus", taggerStatus.result?.value);

// Manually tag + measure mask
const manual = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    for (const el of document.querySelectorAll('[role="dialog"] button')) {
      const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
      if (/^(light|светл)/i.test(label)) el.setAttribute("data-beam-icon", "sun");
      else if (/^(dark|т[её]мн)/i.test(label)) el.setAttribute("data-beam-icon", "moon");
      else if (/^(system|систем)/i.test(label)) el.setAttribute("data-beam-icon", "monitor");
    }
    return [...document.querySelectorAll('[role="dialog"] button[data-beam-icon]')].map((el) => {
      const svg = el.querySelector("svg");
      const cs = svg ? getComputedStyle(svg) : null;
      return {
        role: el.getAttribute("data-beam-icon"),
        label: ((el.innerText||"")+"").trim().split("\\n")[0].trim(),
        mask: cs ? (cs.webkitMaskImage || cs.maskImage || "").slice(0,140) : null,
        pathOp: svg?.querySelector("path") ? getComputedStyle(svg.querySelector("path")).opacity : null,
      };
    });
  })()`,
});
console.log("manual", JSON.stringify(manual.result?.value, null, 2));

// Persistent CSS using exact parent fragment + also aria/text independent host class
const EXTRA = `
/* ===== BEAM theme-chips coolicons v4d ===== */
[role="dialog"] [class*="${parentFrag}"] > button:nth-child(1) svg,
[role="dialog"] [class*="${parentFrag}"] > button:nth-child(1) > svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  background-color: currentColor !important;
  width: 16px !important; height: 16px !important; overflow: hidden !important;
}
[role="dialog"] [class*="${parentFrag}"] > button:nth-child(2) svg,
[role="dialog"] [class*="${parentFrag}"] > button:nth-child(2) > svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  background-color: currentColor !important;
  width: 16px !important; height: 16px !important; overflow: hidden !important;
}
[role="dialog"] [class*="${parentFrag}"] > button:nth-child(3) svg,
[role="dialog"] [class*="${parentFrag}"] > button:nth-child(3) > svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  background-color: currentColor !important;
  width: 16px !important; height: 16px !important; overflow: hidden !important;
}
[role="dialog"] [class*="${parentFrag}"] > button svg * {
  opacity: 0 !important; fill: transparent !important; stroke: transparent !important;
}
[role="dialog"] button[data-beam-icon="sun"] svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button[data-beam-icon="moon"] svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button[data-beam-icon="monitor"] svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] button[data-beam-icon="sun"] svg *,
[role="dialog"] button[data-beam-icon="moon"] svg *,
[role="dialog"] button[data-beam-icon="monitor"] svg * {
  opacity: 0 !important; fill: transparent !important; stroke: transparent !important;
}
`;

// Stronger inline tagger as standalone MutationObserver so it always runs
const OBSERVER = `
<script id="beam-theme-icon-observer-v4d">
(() => {
  const tag = () => {
    try {
      for (const el of document.querySelectorAll("button")) {
        if (el.closest("#beam-side-limits,.bsl-rings,.bsl-chart")) continue;
        const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
        if (!label || label.length > 24) continue;
        if (/^(general|общие)$/i.test(label)) el.setAttribute("data-beam-icon", "general");
        else if (/^(profile|профиль|account|аккаунт)$/i.test(label)) el.setAttribute("data-beam-icon", "user");
        else if (/^(limits|лимиты|лимит)$/i.test(label)) el.setAttribute("data-beam-icon", "limits");
        else if (/^(models?|модели|модель)$/i.test(label)) el.setAttribute("data-beam-icon", "model");
        else if (/^(light|светл)/i.test(label)) el.setAttribute("data-beam-icon", "sun");
        else if (/^(dark|т[её]мн)/i.test(label)) el.setAttribute("data-beam-icon", "moon");
        else if (/^(system|систем)/i.test(label)) el.setAttribute("data-beam-icon", "monitor");
      }
    } catch {}
  };
  const start = () => {
    tag();
    try { new MutationObserver(() => tag()).observe(document.documentElement, { childList: true, subtree: true }); } catch {}
    setInterval(tag, 1200);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>
`;

function uniqExisting(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths) {
    const n = path.normalize(p);
    if (seen.has(n) || !fs.existsSync(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

for (const dist of uniqExisting(FRONTENDS)) {
  const cssPath = path.join(dist, "assets/beam-override.css");
  let css = fs.readFileSync(cssPath, "utf8");
  css = css.replace(/\n?\/\* ===== BEAM theme-chips coolicons v4d ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g, "\n");
  css = css.trimEnd() + "\n" + EXTRA + "\n";
  fs.writeFileSync(cssPath, css);

  const htmlPath = path.join(dist, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE}"`
  );
  if (!html.includes("beam-theme-icon-observer-v4d")) {
    if (html.includes("</body>")) html = html.replace("</body>", OBSERVER + "\n</body>");
    else html += OBSERVER;
  }
  fs.writeFileSync(htmlPath, html);
  console.log("patched", path.relative(ROOT, dist) || dist);
}

await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 4000));
await send("Runtime.evaluate", { expression: `document.querySelector('.bsl-gear')?.click(); true`, returnByValue: true });
await new Promise((r) => setTimeout(r, 1500));

const verify = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const pick = (re) => [...document.querySelectorAll('[role="dialog"] button')].filter((el) => re.test(((el.innerText||"")+"").trim().split("\\n")[0].trim()));
    const map = (els) => els.map((el) => {
      const svg = el.querySelector("svg");
      const cs = svg ? getComputedStyle(svg) : null;
      return {
        label: ((el.innerText||"")+"").trim().split("\\n")[0].trim(),
        beam: el.getAttribute("data-beam-icon"),
        mask: cs ? (cs.webkitMaskImage || cs.maskImage || "").slice(0,140) : null,
      };
    });
    return {
      css: document.querySelector('link[href*="beam-override"]')?.href,
      themes: map(pick(/светл|тёмн|темн|систем|light|dark|system/i)),
      nav: map([...document.querySelectorAll('[class*="navList"] button')]),
      rings: (() => {
        const svg = document.querySelector('#beam-side-limits .bsl-rings svg');
        if (!svg) return null;
        return { mask: getComputedStyle(svg).webkitMaskImage, stroke: getComputedStyle(svg.querySelector('circle')||svg).stroke };
      })(),
    };
  })()`,
});
console.log("verify", JSON.stringify(verify.result?.value, null, 2));
fs.writeFileSync(path.join(OUT, "theme-verify2.json"), JSON.stringify(verify.result?.value, null, 2));
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(OUT, "12-settings-themes-v4d.png"), Buffer.from(shot.data, "base64"));
ws.close();
console.log("DONE", CACHE);
