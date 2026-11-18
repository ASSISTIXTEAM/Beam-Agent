import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "_verify-icons-v4-out");
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
let WS;
try { WS = require("ws"); } catch {
  execSync("npm install ws --no-save", { cwd: __dirname, stdio: "inherit" });
  WS = require("ws");
}

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
await send("Page.enable");

const evalExpr = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 2));
  return r.result?.value;
};

// Hard reload to pick up v4b
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 3500));

const cssHref = await evalExpr(`document.querySelector('link[href*="beam-override"]')?.href || ""`);
console.log("cssHref", cssHref);

await evalExpr(`document.querySelector('.bsl-gear,[data-act="settings"]')?.click(); true`);
await new Promise((r) => setTimeout(r, 1200));

const audit = await evalExpr(`(() => {
  const cells = [...document.querySelectorAll('[class*="navList"] button, button[class*="navCell"]')].map((el) => {
    const svg = el.querySelector("svg");
    const cs = svg ? getComputedStyle(svg) : null;
    return {
      label: ((el.innerText || "") + "").trim().split("\\n")[0].trim(),
      beam: el.getAttribute("data-beam-icon"),
      svgs: el.querySelectorAll("svg").length,
      mask: cs ? (cs.webkitMaskImage || cs.maskImage || "").slice(0, 140) : null,
      bg: cs?.backgroundColor,
      pathOpacity: svg ? getComputedStyle(svg.querySelector("path") || svg).opacity : null,
    };
  });
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
  const rings = (() => {
    const svg = document.querySelector("#beam-side-limits .bsl-rings svg");
    if (!svg) return null;
    const cs = getComputedStyle(svg);
    const c = svg.querySelector("circle");
    return {
      mask: cs.webkitMaskImage || cs.maskImage,
      stroke: c ? getComputedStyle(c).stroke : null,
    };
  })();
  return { cells, themes, rings };
})()`);

console.log(JSON.stringify(audit, null, 2));
fs.writeFileSync(path.join(OUT, "settings-nav2.json"), JSON.stringify({ cssHref, audit }, null, 2));

const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(OUT, "07-settings-v4b.png"), Buffer.from(shot.data, "base64"));

// Open profile tab
await evalExpr(`(() => {
  for (const el of document.querySelectorAll('[class*="navList"] button')) {
    if (/профиль|profile/i.test((el.innerText||"").trim())) { el.click(); return true; }
  }
  return false;
})()`);
await new Promise((r) => setTimeout(r, 700));
const shotP = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(OUT, "08-settings-profile.png"), Buffer.from(shotP.data, "base64"));

// Limits tab
await evalExpr(`(() => {
  for (const el of document.querySelectorAll('[class*="navList"] button')) {
    if (/лимит|limits/i.test((el.innerText||"").trim())) { el.click(); return true; }
  }
  return false;
})()`);
await new Promise((r) => setTimeout(r, 700));
const shotL = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(OUT, "09-settings-limits.png"), Buffer.from(shotL.data, "base64"));

// Escape and open model picker
await evalExpr(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); true`);
await new Promise((r) => setTimeout(r, 400));
const modelClick = await evalExpr(`(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => {
    const t = ((el.getAttribute("aria-label")||"")+" "+(el.innerText||"")).toLowerCase();
    return /model|модел|flare|tide|pine/.test(t) && !el.closest("#beam-side-limits") && el.offsetParent;
  });
  if (btn) btn.click();
  return btn ? ((btn.getAttribute("aria-label")||"")+" "+(btn.innerText||"")).trim().slice(0,80) : null;
})()`);
console.log("modelClick", modelClick);
await new Promise((r) => setTimeout(r, 800));
const shotM = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(path.join(OUT, "10-models-picker.png"), Buffer.from(shotM.data, "base64"));

const modelAudit = await evalExpr(`(() => {
  return [...document.querySelectorAll("[data-beam-icon='model'], [data-beam-icon='chip']")].map((el) => ({
    label: ((el.getAttribute("aria-label")||"")+" "+(el.innerText||"")).trim().slice(0,50),
    mask: (() => {
      const s = el.querySelector("svg");
      if (!s) return null;
      return (getComputedStyle(s).webkitMaskImage || "").slice(0, 120);
    })(),
  }));
})()`);
console.log("modelAudit", JSON.stringify(modelAudit, null, 2));

ws.close();
console.log("DONE");
