import fs from "node:fs";

const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page" && String(p.url).includes("beam-app://app"));
if (!page) {
  console.error("no page");
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
  ws.addEventListener("error", j);
});
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

await send("Runtime.enable");
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 5500));

const probe = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const rows = [...document.querySelectorAll('[class*="sessionRow"]')].slice(0, 6);
    const dots = rows.map((row) => {
      const slot = row.querySelector(':scope > [class*="slot"]');
      const before = slot ? getComputedStyle(slot, '::before') : null;
      const w = before ? parseFloat(before.width) : 0;
      const h = before ? parseFloat(before.height) : 0;
      const br = before ? before.borderRadius : '';
      return {
        title: (row.querySelector('[class*="title"]')?.textContent || '').slice(0, 36),
        selected: row.getAttribute('aria-selected') === 'true' || /selected/i.test(row.className),
        content: before?.content || null,
        w, h,
        radius: br,
        bg: before?.backgroundColor || null,
        isCircle: w > 0 && h > 0 && Math.abs(w - h) < 0.6 && w <= 8,
        isDash: w >= 8 && h <= 3,
        hasHistStrip: !!row.querySelector('.beam-hist-strip'),
      };
    });
    let side = rows[0];
    for (let i = 0; i < 8 && side?.parentElement; i++) {
      const p = side.parentElement;
      const pr = p.getBoundingClientRect();
      if (pr.width > 180 && pr.width < 420 && pr.left < 100) { side = p; break; }
      side = p;
    }
    const r = (side || rows[0]).getBoundingClientRect();
    return {
      rail: !!document.getElementById('beam-hist-rail'),
      strips: document.querySelectorAll('.beam-hist-strip').length,
      dots,
      allCircles: dots.every((d) => d.isCircle && !d.isDash && !d.hasHistStrip),
      clip: {
        x: Math.max(0, r.left),
        y: Math.max(0, r.top - 8),
        width: Math.min(340, Math.max(220, r.width)),
        height: Math.min(420, Math.max(180, r.height)),
        scale: 1,
      },
    };
  })()`,
});

const val = probe.result?.result?.value;
console.log(JSON.stringify({
  rail: val?.rail,
  strips: val?.strips,
  allCircles: val?.allCircles,
  dots: val?.dots,
}, null, 2));

const shot = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  clip: val.clip,
});
const out = "c:/Users/Alexa/OneDrive/Documents/Beam Agent/desktop/_proof-session-dots.png";
fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log("wrote", out, fs.statSync(out).size);
ws.close();

if (!val?.allCircles) {
  console.error("PROOF FAILED: left markers are not quiet circles");
  process.exit(2);
}
console.log("PROOF OK: left session rows use circular dots, no dashes");
