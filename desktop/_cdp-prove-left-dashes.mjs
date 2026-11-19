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
// wait for UI
for (let i = 0; i < 20; i++) {
  const ready = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `document.querySelectorAll('[class*="sessionRow"], [role="treeitem"]').length`,
  });
  const n = ready.result?.result?.value ?? 0;
  if (n > 0) break;
  await new Promise((r) => setTimeout(r, 1000));
}

const report = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const rows = [...document.querySelectorAll('[class*="sessionRow"], [role="treeitem"][data-row-key^="session:"]')].slice(0, 8);
    const rowInfo = rows.map((row) => {
      const cs = getComputedStyle(row);
      const before = getComputedStyle(row, '::before');
      const after = getComputedStyle(row, '::after');
      const kids = [...row.children].map((c) => {
        const kcs = getComputedStyle(c);
        const kb = getComputedStyle(c, '::before');
        return {
          tag: c.tagName,
          cls: String(c.className).slice(0, 80),
          beamIcon: c.getAttribute('data-beam-icon'),
          w: Math.round(kcs.width.replace('px','')||0),
          h: Math.round(kcs.height.replace('px','')||0),
          bg: kcs.backgroundColor,
          beforeContent: kb.content,
          beforeW: kb.width,
          beforeH: kb.height,
          beforeBg: kb.backgroundColor,
          beforeDisplay: kb.display,
          html: c.outerHTML.slice(0, 180),
        };
      });
      // absolute/fixed thin bars overlapping this row
      const rr = row.getBoundingClientRect();
      const overlays = [...document.querySelectorAll('body *')].filter((el) => {
        if (el === row || row.contains(el)) return false;
        const r = el.getBoundingClientRect();
        if (r.height < 1 || r.height > 6) return false;
        if (r.width < 4 || r.width > 80) return false;
        if (r.left > rr.left + 40) return false;
        if (r.right < rr.left - 2) return false;
        if (r.top > rr.bottom || r.bottom < rr.top) return false;
        return true;
      }).slice(0, 6).map((el) => ({
        tag: el.tagName,
        id: el.id,
        cls: String(el.className).slice(0, 80),
        rect: (() => { const r = el.getBoundingClientRect(); return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}; })(),
        html: el.outerHTML.slice(0, 160),
      }));
      return {
        text: (row.textContent || '').trim().slice(0, 40),
        cls: String(row.className).slice(0, 80),
        key: row.getAttribute('data-row-key'),
        before: { content: before.content, w: before.width, h: before.height, bg: before.backgroundColor, display: before.display, pos: before.position },
        after: { content: after.content, w: after.width, h: after.height, bg: after.backgroundColor },
        kids,
        overlays,
      };
    });
    return {
      v2: !!window.__beamHistStripsV2,
      rail: !!document.getElementById('beam-hist-rail'),
      peek: !!document.getElementById('beam-hist-peek'),
      histStrips: document.querySelectorAll('.beam-hist-strip').length,
      script: !!document.getElementById('beam-history-strips'),
      rows: rowInfo,
      allThinLeft: [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.height <= 4 && r.width >= 6 && r.width <= 48 && r.left < 120 && r.top > 80;
      }).slice(0, 20).map((el) => ({
        id: el.id, cls: String(el.className).slice(0, 60),
        rect: (()=>{const r=el.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};})(),
        parent: el.parentElement && String(el.parentElement.className).slice(0,40),
      })),
    };
  })()`,
});
console.log(JSON.stringify(report.result?.result?.value ?? report, null, 2));

// Capture screenshot of left sidebar region via CDP
const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
const b64 = shot.result?.data;
if (b64) {
  const fs = await import("node:fs");
  const path = "c:/Users/Alexa/Beam-Agent/desktop/_proof-left-sidebar.png";
  fs.writeFileSync(path, Buffer.from(b64, "base64"));
  console.log("screenshot", path, "bytes", Buffer.from(b64, "base64").length);
}
ws.close();
