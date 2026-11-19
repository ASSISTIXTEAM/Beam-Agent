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

const detail = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const rows = [...document.querySelectorAll('[class*="sessionRow"]')];
    const out = [];
    for (const row of rows) {
      const title = (row.querySelector('[class*="title"]')?.textContent || '').trim();
      const rr = row.getBoundingClientRect();
      const slot = row.querySelector('[class*="slot"]');
      const sr = slot?.getBoundingClientRect();
      const styles = (el) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        return {
          border: s.border,
          borderLeft: s.borderLeft,
          boxShadow: s.boxShadow,
          outline: s.outline,
          background: s.background,
          backgroundImage: s.backgroundImage,
          mask: s.webkitMaskImage || s.maskImage,
          transform: s.transform,
          content: null,
        };
      };
      const before = getComputedStyle(row, '::before');
      const slotBefore = slot ? getComputedStyle(slot, '::before') : null;
      // Elements intersecting left 28px of this row
      const hits = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.bottom < rr.top + 2 || r.top > rr.bottom - 2) continue;
        if (r.right < rr.left || r.left > rr.left + 28) continue;
        if (r.height > 24) continue;
        hits.push({
          tag: el.tagName,
          id: el.id,
          cls: String(el.className || '').slice(0, 70),
          text: (el.textContent || '').trim().slice(0, 20),
          rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
          bg: getComputedStyle(el).backgroundColor,
          color: getComputedStyle(el).color,
          html: el.outerHTML.slice(0, 140),
        });
      }
      out.push({
        title: title.slice(0, 40),
        indent: row.style.getPropertyValue('--dsh-workspace-indent') || getComputedStyle(row).getPropertyValue('--dsh-workspace-indent'),
        padStart: getComputedStyle(row).paddingInlineStart,
        rowStyle: styles(row),
        slotStyle: styles(slot),
        before: { content: before.content, bg: before.backgroundColor, w: before.width, h: before.height, display: before.display, shadow: before.boxShadow },
        slotBefore: slotBefore && { content: slotBefore.content, bg: slotBefore.backgroundColor, w: slotBefore.width, h: slotBefore.height, display: slotBefore.display },
        slotRect: sr && { x: Math.round(sr.left), y: Math.round(sr.top), w: Math.round(sr.width), h: Math.round(sr.height) },
        rowRect: { x: Math.round(rr.left), y: Math.round(rr.top), w: Math.round(rr.width), h: Math.round(rr.height) },
        hits: hits.slice(0, 12),
        slotHTML: slot?.innerHTML?.slice(0, 300) || '',
      });
    }
    return {
      rail: !!document.getElementById('beam-hist-rail'),
      strips: document.querySelectorAll('.beam-hist-strip').length,
      rows: out,
    };
  })()`,
});

const val = detail.result?.result?.value;
fs.writeFileSync(
  "c:/Users/Alexa/Beam-Agent/desktop/_proof-gutter-probe.json",
  JSON.stringify(val, null, 2)
);
console.log("rail", val.rail, "strips", val.strips, "rows", val.rows.length);
for (const r of val.rows) {
  console.log("---", r.title, "indent="+r.indent, "hits="+r.hits.length);
  if (r.hits.length) console.log(JSON.stringify(r.hits, null, 2));
  if (r.slotHTML && r.slotHTML !== '<div data-slot="sidebar.session.row.leading" style="display: contents;"></div>') {
    console.log("slotHTML", r.slotHTML);
  }
}

// Crop zoom on a nested session title row gutter
const nested = val.rows.find((r) => /Вопрос о личности ассист/.test(r.title)) || val.rows[3];
if (nested) {
  const c = nested.rowRect;
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    clip: { x: c.x, y: c.y - 2, width: Math.min(220, c.w), height: c.h + 4, scale: 2 },
  });
  const p = "c:/Users/Alexa/Beam-Agent/desktop/_proof-row-gutter-zoom.png";
  fs.writeFileSync(p, Buffer.from(shot.result.data, "base64"));
  console.log("zoom", p);
}

ws.close();
