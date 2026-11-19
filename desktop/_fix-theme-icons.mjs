import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "desktop/_verify-icons-v4-out");
const CACHE = "coolicons-everywhere-v4c";
const require = createRequire(import.meta.url);
let WS;
try { WS = require("ws"); } catch {
  execSync("npm install ws --no-save", { cwd: path.join(ROOT, "desktop"), stdio: "inherit" });
  WS = require("ws");
}

const FRONTENDS = [
  path.join(ROOT, "runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "runtime/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist"),
  path.join(ROOT, "dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist"),
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist",
  "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@deepseek-ai/dsh-web-frontend/dist",
];

// 1) Probe theme button DOM via CDP
const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page") || list[0];
const ws = new WS(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => {
  const i = ++id;
  return new Promise((res, rej) => {
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
};
await new Promise((r, j) => { ws.on("open", r); ws.on("error", j); });
ws.on("message", (data) => {
  const msg = JSON.parse(String(data));
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(JSON.stringify(msg.error)));
    else res(msg.result);
  }
});
await send("Runtime.enable");

const probe = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    document.querySelector('.bsl-gear')?.click();
    const themes = [...document.querySelectorAll('[role="dialog"] button')].filter((el) => {
      const t = ((el.innerText || "") + "").trim().split("\\n")[0].trim();
      return /^(Светл|Тёмн|Темн|Систем|Light|Dark|System)/i.test(t);
    });
    return themes.map((el) => ({
      label: ((el.innerText || "") + "").trim().split("\\n")[0].trim(),
      cls: String(el.className || ""),
      parentCls: String(el.parentElement?.className || "").slice(0, 120),
      grandCls: String(el.parentElement?.parentElement?.className || "").slice(0, 120),
      html: el.outerHTML.slice(0, 350),
      siblingIndex: [...(el.parentElement?.children || [])].indexOf(el),
      siblingCount: el.parentElement?.children?.length,
    }));
  })()`,
});
console.log("probe", JSON.stringify(probe.result?.value, null, 2));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "theme-probe.json"), JSON.stringify(probe.result?.value, null, 2));

const themes = probe.result?.value || [];
const parentCls = themes[0]?.parentCls || "";
const token = (parentCls.match(/[A-Za-z0-9_-]*(theme|Theme|appearance|Appearance|segment|Segment|radio|Radio|option|Option)[A-Za-z0-9_-]*/g) || [])[0]
  || (parentCls.split(/\s+/).find((c) => c.length > 4) || "");

console.log("parentToken", token, "parentCls", parentCls);

const EXTRA_CSS = `
/* ===== BEAM theme-chips coolicons v4c ===== */
/* Appearance Light/Dark/System — target by labeled buttons inside settings dialog */
[role="dialog"] button[data-beam-icon="sun"] svg,
[role="dialog"] button[data-beam-icon="moon"] svg,
[role="dialog"] button[data-beam-icon="monitor"] svg {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  min-height: 16px !important;
  background-color: currentColor !important;
  overflow: hidden !important;
}
[role="dialog"] button[data-beam-icon="sun"] svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
}
[role="dialog"] button[data-beam-icon="moon"] svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
}
[role="dialog"] button[data-beam-icon="monitor"] svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
}
[role="dialog"] button[data-beam-icon="sun"] svg *,
[role="dialog"] button[data-beam-icon="moon"] svg *,
[role="dialog"] button[data-beam-icon="monitor"] svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
/* Sibling-order fallback when parent is a 3-option theme row */
[role="dialog"] [class*="segmented"] > button:nth-child(1) svg,
[role="dialog"] [class*="Segmented"] > button:nth-child(1) svg,
[role="dialog"] [class*="themeRow"] > button:nth-child(1) svg,
[role="dialog"] [class*="appearanceOptions"] > button:nth-child(1) svg,
[role="dialog"] [class*="radioGroup"] > button:nth-child(1) svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="segmented"] > button:nth-child(2) svg,
[role="dialog"] [class*="Segmented"] > button:nth-child(2) svg,
[role="dialog"] [class*="themeRow"] > button:nth-child(2) svg,
[role="dialog"] [class*="appearanceOptions"] > button:nth-child(2) svg,
[role="dialog"] [class*="radioGroup"] > button:nth-child(2) svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="segmented"] > button:nth-child(3) svg,
[role="dialog"] [class*="Segmented"] > button:nth-child(3) svg,
[role="dialog"] [class*="themeRow"] > button:nth-child(3) svg,
[role="dialog"] [class*="appearanceOptions"] > button:nth-child(3) svg,
[role="dialog"] [class*="radioGroup"] > button:nth-child(3) svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
`;

// Build parent-class-specific rule if we found a useful parent class token
let parentRule = "";
if (themes.length === 3 && themes[0]?.parentCls) {
  const clsParts = String(themes[0].parentCls).split(/\s+/).filter(Boolean);
  // Prefer hashed module class
  const main = clsParts.find((c) => /_/.test(c)) || clsParts[0];
  if (main) {
    parentRule = `
/* Theme parent class from live DOM: ${main} */
[role="dialog"] .${CSS.escape ? CSS.escape(main) : main.replace(/[^a-zA-Z0-9_-]/g, "\\\\$&")} > button:nth-child(1) svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] .${main.replace(/[^a-zA-Z0-9_-]/g, "\\$&")} > button:nth-child(2) svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] .${main.replace(/[^a-zA-Z0-9_-]/g, "\\$&")} > button:nth-child(3) svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] .${main.replace(/[^a-zA-Z0-9_-]/g, "\\$&")} > button svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
`;
    // Simpler: use attribute selector on class substring without escape issues
    const frag = main.slice(0, Math.min(main.length, 12));
    parentRule = `
/* Theme row parent (live): ${main} */
[role="dialog"] [class*="${frag}"] > button:nth-child(1) svg {
  -webkit-mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/sun.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="${frag}"] > button:nth-child(2) svg {
  -webkit-mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/moon.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="${frag}"] > button:nth-child(3) svg {
  -webkit-mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  mask: url("./beam-icons/bold/desktop.png") center / contain no-repeat !important;
  background-color: currentColor !important;
}
[role="dialog"] [class*="${frag}"] > button svg * {
  opacity: 0 !important;
  fill: transparent !important;
  stroke: transparent !important;
}
`;
  }
}

const TAGGER = `
/* beam-theme-tagger-v4c */
try {
  for (const el of document.querySelectorAll('[role="dialog"] button, [class*="settings"] button, [class*="Settings"] button, [class*="AnXs9G_"] button')) {
    if (el.closest("#beam-side-limits,.bsl-rings")) continue;
    const label = ((el.getAttribute("aria-label") || "") + " " + (el.innerText || "")).trim().split("\\n")[0].trim();
    if (/^(light|светл)/i.test(label)) el.setAttribute("data-beam-icon", "sun");
    else if (/^(dark|т[её]мн)/i.test(label)) el.setAttribute("data-beam-icon", "moon");
    else if (/^(system|систем)/i.test(label)) el.setAttribute("data-beam-icon", "monitor");
  }
} catch {}
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
  css = css.replace(/\n?\/\* ===== BEAM theme-chips coolicons v4c ===== \*\/[\s\S]*?(?=\n\/\* =====|$)/g, "\n");
  css = css.trimEnd() + "\n" + EXTRA_CSS + parentRule + "\n";
  fs.writeFileSync(cssPath, css);

  const htmlPath = path.join(dist, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace(
    /href="\.\/assets\/beam-override\.css(?:\?[^"]*)?"/g,
    `href="./assets/beam-override.css?v=${CACHE}"`
  );
  if (!html.includes("/* beam-theme-tagger-v4c */")) {
    html = html.replace(
      "beamStripNewSessionIconHosts();",
      `beamStripNewSessionIconHosts();\n${TAGGER}`
    );
  }
  // Also force theme tagging even when label length / svg count would skip main loop — already in dedicated tagger
  fs.writeFileSync(htmlPath, html);
  console.log("patched", path.relative(ROOT, dist) || dist);
}

// Reload + verify
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 3500));
await send("Runtime.evaluate", {
  expression: `document.querySelector('.bsl-gear')?.click(); true`,
  returnByValue: true,
});
await new Promise((r) => setTimeout(r, 1200));

const verify = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const themes = [...document.querySelectorAll('[role="dialog"] button')].filter((el) => {
      const t = ((el.innerText || "") + "").trim().split("\\n")[0].trim();
      return /^(Светл|Тёмн|Темн|Систем|Light|Dark|System)/i.test(t);
    }).map((el) => {
      const svg = el.querySelector("svg");
      const cs = svg ? getComputedStyle(svg) : null;
      return {
        label: ((el.innerText || "") + "").trim().split("\\n")[0].trim(),
        beam: el.getAttribute("data-beam-icon"),
        mask: cs ? (cs.webkitMaskImage || cs.maskImage || "").slice(0, 140) : null,
      };
    });
    const cells = [...document.querySelectorAll('[class*="navList"] button')].map((el) => {
      const svg = el.querySelector("svg");
      return {
        label: ((el.innerText || "") + "").trim().split("\\n")[0].trim(),
        mask: svg ? (getComputedStyle(svg).webkitMaskImage || "").slice(0, 100) : null,
      };
    });
    const ring = (() => {
      const svg = document.querySelector("#beam-side-limits .bsl-rings svg");
      if (!svg) return null;
      return { mask: getComputedStyle(svg).webkitMaskImage || getComputedStyle(svg).maskImage, stroke: getComputedStyle(svg.querySelector("circle") || svg).stroke };
    })();
    return { css: document.querySelector('link[href*="beam-override"]')?.href, themes, cells, ring };
  })()`,
});
console.log("verify", JSON.stringify(verify.result?.value, null, 2));
fs.writeFileSync(path.join(OUT, "theme-verify.json"), JSON.stringify(verify.result?.value, null, 2));

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(OUT, "11-settings-themes.png"), Buffer.from(shot.data, "base64"));

ws.close();
console.log("DONE", CACHE);
