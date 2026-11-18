import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "_verify-icons-v4-out");
const WS = createRequire(import.meta.url)("ws");
const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const ws = new WS(list[0].webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await new Promise((r, j) => {
  ws.on("open", r);
  ws.on("error", j);
});
ws.on("message", (d) => {
  const m = JSON.parse(String(d));
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  }
});
await send("Runtime.enable");
await send("Page.enable");
await send("Runtime.evaluate", {
  expression: "document.querySelector('.bsl-gear')?.click(); true",
  returnByValue: true,
});
await new Promise((r) => setTimeout(r, 1000));
const box = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const nav = document.querySelector('[class*="navList"]');
    const themes = document.querySelector('[class*="cubeRow"]');
    const dpr = window.devicePixelRatio || 1;
    const pack = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, dpr };
    };
    return {
      nav: pack(nav),
      themes: pack(themes),
      cells: [...document.querySelectorAll('[class*="navList"] button')].map((el) => ({
        label: (el.innerText || "").trim(),
        beam: el.getAttribute("data-beam-icon"),
        mask: (getComputedStyle(el.querySelector("svg")).webkitMaskImage || "").slice(0, 100),
        pathOp: getComputedStyle(el.querySelector("path") || el).opacity,
      })),
      themeCells: [...document.querySelectorAll('button[class*="themeCube"]')].map((el) => ({
        label: (el.innerText || "").trim(),
        beam: el.getAttribute("data-beam-icon"),
        mask: (getComputedStyle(el.querySelector("svg")).webkitMaskImage || "").slice(0, 100),
      })),
    };
  })()`,
});
console.log(JSON.stringify(box.result.value, null, 2));
for (const [name, b] of [
  ["18-nav-crop", box.result.value.nav],
  ["18-theme-crop", box.result.value.themes],
]) {
  if (!b) continue;
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: b.x, y: b.y, width: Math.max(b.w, 1), height: Math.max(b.h, 1), scale: 2 },
  });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.data, "base64"));
  console.log("wrote", name);
}
ws.close();
