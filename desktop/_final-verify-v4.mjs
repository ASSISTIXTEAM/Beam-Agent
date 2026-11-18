import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "desktop/_verify-icons-v4-out");
const WS = createRequire(import.meta.url)("ws");
fs.mkdirSync(OUT, { recursive: true });

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
const evalExpr = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const p = path.join(OUT, `${name}.png`);
  fs.writeFileSync(p, Buffer.from(r.data, "base64"));
  return p;
};

await evalExpr(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); true`);
await new Promise((r) => setTimeout(r, 300));

// Rings color audit — look at all circles/strokes
const ringColors = await evalExpr(`(() => {
  const rings = [...document.querySelectorAll("#beam-side-limits .bsl-rings svg")];
  return rings.map((svg, i) => {
    const cs = getComputedStyle(svg);
    const parts = [...svg.querySelectorAll("circle, path, ellipse")].map((n) => {
      const s = getComputedStyle(n);
      return { tag: n.tagName, stroke: s.stroke, strokeAttr: n.getAttribute("stroke"), opacity: s.opacity, className: String(n.getAttribute("class")||"") };
    });
    return { i, mask: cs.webkitMaskImage || cs.maskImage, bg: cs.backgroundColor, parts };
  });
})()`);
console.log("ringColors", JSON.stringify(ringColors, null, 2));

await shot("13-home-rings");

// Settings
await evalExpr(`document.querySelector('.bsl-gear')?.click(); true`);
await new Promise((r) => setTimeout(r, 1000));
await shot("14-settings-general");

await evalExpr(`([...document.querySelectorAll('[class*="navList"] button')].find(b=>/профиль/i.test(b.innerText||""))||{}).click?.(); true`);
await new Promise((r) => setTimeout(r, 700));
await shot("15-settings-profile");

await evalExpr(`([...document.querySelectorAll('[class*="navList"] button')].find(b=>/лимит/i.test(b.innerText||""))||{}).click?.(); true`);
await new Promise((r) => setTimeout(r, 700));
await shot("16-settings-limits");

// Summary of all masked icons currently
const summary = await evalExpr(`(() => {
  const icons = [...document.querySelectorAll("[data-beam-icon]")];
  const byRole = {};
  for (const el of icons) {
    const role = el.getAttribute("data-beam-icon");
    const svg = el.querySelector("svg") || (el.classList.contains("bsl-gear-ico") ? el : null);
    const mask = svg ? (getComputedStyle(svg).webkitMaskImage || getComputedStyle(svg).maskImage || "") : "";
    const ok = /beam-icons\\/(bold|fill)\\//.test(mask) || (role === "more" && !svg);
    byRole[role] = byRole[role] || { count: 0, masked: 0, sample: null };
    byRole[role].count++;
    if (ok) byRole[role].masked++;
    if (!byRole[role].sample) byRole[role].sample = mask.slice(0, 100);
  }
  const gear = document.querySelector(".bsl-gear-ico");
  return {
    css: document.querySelector('link[href*="beam-override"]')?.href,
    byRole,
    gearMask: gear ? (getComputedStyle(gear).webkitMaskImage || "").slice(0, 120) : null,
    nav: [...document.querySelectorAll('[class*="navList"] button')].map((el) => ({
      label: (el.innerText||"").trim(),
      beam: el.getAttribute("data-beam-icon"),
      mask: (getComputedStyle(el.querySelector("svg")).webkitMaskImage||"").slice(0,100),
    })),
    themes: [...document.querySelectorAll("button.Iwzhua_themeCube, button[class*='themeCube']")].map((el) => ({
      label: (el.innerText||"").trim(),
      beam: el.getAttribute("data-beam-icon"),
      mask: (getComputedStyle(el.querySelector("svg")).webkitMaskImage||"").slice(0,100),
    })),
  };
})()`);
console.log("summary", JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT, "final-summary.json"), JSON.stringify({ ringColors, summary }, null, 2));

// Models picker
await evalExpr(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); true`);
await new Promise((r) => setTimeout(r, 400));
await evalExpr(`(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => /model|модел|flare|tide|pine|auto/i.test(((el.getAttribute("aria-label")||"")+" "+(el.innerText||""))) && !el.closest("#beam-side-limits") && el.offsetParent);
  btn?.click();
  return !!btn;
})()`);
await new Promise((r) => setTimeout(r, 800));
await shot("17-models-picker");

const model = await evalExpr(`(() => {
  const btn = document.querySelector('[data-beam-icon="model"]');
  const svg = btn?.querySelector("svg");
  return {
    label: btn ? ((btn.getAttribute("aria-label")||"")+" "+(btn.innerText||"")).trim().slice(0,80) : null,
    mask: svg ? (getComputedStyle(svg).webkitMaskImage||"").slice(0,120) : null,
  };
})()`);
console.log("model", model);

ws.close();
console.log("DONE");
