import fs from "node:fs";

const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page" && String(p.url).includes("beam-app://app"));
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

const metrics = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const row = document.querySelector('[class*="sessionRow"]');
    let side = row;
    for (let i = 0; i < 8 && side?.parentElement; i++) {
      const p = side.parentElement;
      const pr = p.getBoundingClientRect();
      if (pr.width > 180 && pr.width < 420 && pr.left < 80) { side = p; break; }
      side = p;
    }
    const r = (side || row).getBoundingClientRect();
    const rows = [...document.querySelectorAll('[class*="sessionRow"]')];
    const dashProbe = rows.map((el) => {
      const before = getComputedStyle(el, '::before');
      const slot = el.querySelector('[class*="slot"]');
      const slotBefore = slot ? getComputedStyle(slot, '::before') : null;
      return {
        title: (el.querySelector('[class*="title"]')?.textContent || '').slice(0, 40),
        rowBefore: before.content,
        slotBefore: slotBefore?.content || null,
        hasHistStrip: !!el.querySelector('.beam-hist-strip'),
      };
    });
    return {
      clip: {
        x: Math.max(0, r.left),
        y: Math.max(0, r.top - 8),
        width: Math.min(340, Math.max(220, r.width)),
        height: Math.min(480, Math.max(200, r.height)),
        scale: 1,
      },
      proof: {
        rail: !!document.getElementById('beam-hist-rail'),
        strips: document.querySelectorAll('.beam-hist-strip').length,
        v2: !!window.__beamHistStripsV2,
        rightMarks: document.querySelectorAll('[data-conversation-scroll] [class*="_frame"] button[class*="_mark"]').length,
        rightFrame: !!document.querySelector('[data-conversation-scroll] [class*="_frame"]'),
        dashProbe,
      },
    };
  })()`,
});

const val = metrics.result?.result?.value;
console.log(JSON.stringify(val?.proof, null, 2));

const shot = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  clip: val.clip,
});
const out = "c:/Users/Alexa/Beam-Agent/desktop/_proof-left-sidebar-clean.png";
fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log("wrote", out, fs.statSync(out).size);

// Simulate hover on right rail if present
if (val.proof.rightMarks > 0) {
  const paint = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const marks = [...document.querySelectorAll('[data-conversation-scroll] [class*="_frame"] button[class*="_mark"]')];
      const m = marks[Math.floor(marks.length / 2)] || marks[0];
      const r = m.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const x = r.left + 2;
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
      return marks.slice(0, 6).map((el) => ({
        pull: el.style.getPropertyValue('--beam-pull') || getComputedStyle(el).getPropertyValue('--beam-pull'),
        hot: el.getAttribute('data-beam-hot'),
      }));
    })()`,
  });
  console.log("rightPull", JSON.stringify(paint.result?.result?.value));
}

ws.close();
