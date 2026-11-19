import fs from "node:fs";
import WebSocket from "ws";

const cssPath =
  "c:/Users/Alexa/Beam-Agent/runtime/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css";
const css = fs.readFileSync(cssPath, "utf8");
const start = css.indexOf("/* ===== BEAM_CONTINUE_LAYOUT_FIX ===== */");
if (start < 0) throw new Error("CSS block missing");
const end = css.indexOf("/* ===== /BEAM_CONTINUE_LAYOUT_FIX ===== */", start);
const block = css.slice(start, end + "/* ===== /BEAM_CONTINUE_LAYOUT_FIX ===== */".length);

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((p) => p.url?.includes("beam-app")) || list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  const i = ++id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout " + method)), 15000);
    pending.set(i, {
      resolve: (v) => {
        clearTimeout(t);
        resolve(v);
      },
      reject,
    });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
ws.on("message", (buf) => {
  const msg = JSON.parse(buf.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id).resolve(msg);
    pending.delete(msg.id);
  }
});
await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");

const expr = `(() => {
  let tag = document.getElementById('beam-continue-layout-fix');
  if (!tag) { tag = document.createElement('style'); tag.id = 'beam-continue-layout-fix'; document.head.appendChild(tag); }
  tag.textContent = ${JSON.stringify(block)};
  const items = [...document.querySelectorAll('[role="treeitem"], [class*="sessionRow"]')];
  const hit = items.find(el => /Реферат по истории|Рима/i.test(el.innerText||''));
  if (hit) hit.click();
  return true;
})()`;
await send("Runtime.evaluate", { expression: expr, returnByValue: true });
await new Promise((r) => setTimeout(r, 2000));

const measure = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const cont = document.querySelector('[data-beam-continue]');
    const btn = cont?.querySelector('button');
    const copy = cont?.querySelector('[class*="turnErrorCopy"]');
    const msg = cont?.querySelector('[class*="turnErrorMessage"]');
    const cs = (el) => el ? ({
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      text: (el.innerText||'').replace(/\\n/g,' ').slice(0,60),
      display: getComputedStyle(el).display,
      writingMode: getComputedStyle(el).writingMode,
      whiteSpace: getComputedStyle(el).whiteSpace,
    }) : null;
    const ok = !!(btn && btn.getBoundingClientRect().width >= 80 && btn.getBoundingClientRect().height < 50
      && msg && msg.getBoundingClientRect().width >= 120 && msg.getBoundingClientRect().height < 80);
    return { ok, cont: cs(cont), copy: cs(copy), msg: cs(msg), btn: cs(btn) };
  })()`,
});
console.log(JSON.stringify(measure.result?.result?.value ?? measure, null, 2));
ws.close();
process.exit(0);
