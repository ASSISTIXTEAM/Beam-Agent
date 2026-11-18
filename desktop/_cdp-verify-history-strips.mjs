const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page =
  pages.find((p) => p.type === "page" && /beam-app:\/\/app/.test(p.url)) ||
  pages.find((p) => p.type === "page");
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
await new Promise((r) => setTimeout(r, 5000));

const res = await send("Runtime.evaluate", {
  expression: `(() => ({
    hasScript: !!document.getElementById('beam-history-strips'),
    flag: !!window.__beamHistStrips,
    rail: !!document.getElementById('beam-hist-rail'),
    strips: document.querySelectorAll('.beam-hist-strip').length,
    rows: document.querySelectorAll('[role="treeitem"][data-row-key^="session:"]').length,
    url: location.href,
    bootOk: !/fatal|boot failed/i.test(document.body?.innerText || '')
  }))()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));

// Nudge a paint if rows exist
const paint = await send("Runtime.evaluate", {
  expression: `(() => {
    const rows = [...document.querySelectorAll('[role="treeitem"][data-row-key^="session:"]')];
    if (!rows.length) return { skipped: true };
    const r = rows[Math.min(1, rows.length - 1)].getBoundingClientRect();
    const x = r.left + 8;
    const y = r.top + r.height / 2;
    for (const type of ['pointermove']) {
      document.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }));
    }
    return {
      strips: document.querySelectorAll('.beam-hist-strip').length,
      peek: document.getElementById('beam-hist-peek')?.dataset?.open || '0',
      widths: [...document.querySelectorAll('.beam-hist-strip')].slice(0, 5).map((s) => s.style.width)
    };
  })()`,
  returnByValue: true,
});
console.log("paint", JSON.stringify(paint.result?.result?.value ?? paint, null, 2));
ws.close();
