import fs from "fs";
const css = fs.readFileSync(
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/beam/node_modules/@assistix/beam-web-frontend/dist/assets/beam-override.css",
  "utf8",
);
// Extract all rules mentioning plus or newSession
const chunks = css.split(/(?=\/\* =====)|(?=\[[^\]]*data-beam-icon="plus")|(?=\.wtg9ga_newSession)|(?=\[class\*="newSession")/);
const hits = [];
for (const part of css.match(/[^{}]+\{[^{}]*\}/g) || []) {
  if (/plus|newSession/i.test(part)) hits.push(part.replace(/\s+/g, " ").trim().slice(0, 220));
}
console.log("rules", hits.length);
for (const h of hits) console.log("-", h);

// Also check live computed without inline styles
const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
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
const res = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
  const pick = document.querySelector('button[class*="newSession"], [class*="wtg9ga_newSession"]');
  for (const el of pick?.querySelectorAll('*') || []) el.removeAttribute('style');
  pick?.removeAttribute('style');
  const info = (sel) => {
    const el = pick?.querySelector(sel) || (sel === ':self' ? pick : null);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      cls: String(el.className).slice(0, 60),
      beam: el.getAttribute('data-beam-icon'),
      w: cs.width, h: cs.height,
      mask: (cs.webkitMaskImage || cs.maskImage || '').slice(0, 100),
      bg: cs.backgroundColor,
      fs: cs.fontSize,
      color: cs.color,
      opacity: cs.opacity,
      overflow: cs.overflow,
      display: cs.display,
      text: (el.innerText || '').slice(0, 40),
    };
  };
  return {
    btn: info(':self'),
    mask: info('[class*="newSessionLabelMask"]'),
    content: info('[class*="newSessionContent"]'),
    label: info('[class*="newSessionLabel"]'),
    shortcut: info('[class*="newSessionShortcut"]'),
    svg: (() => {
      const el = pick?.querySelector('svg');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { w: cs.width, mask: (cs.webkitMaskImage||cs.maskImage||'').slice(0,80), bg: cs.backgroundColor };
    })(),
  };
})()`,
});
console.log("\nLIVE AFTER CLEAR INLINE", JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
