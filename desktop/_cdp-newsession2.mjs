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
  const pick = document.querySelector('button.wtg9ga_newSession, button[class*="newSession"]');
  if (!pick) return { error: 'no btn' };
  for (const el of [pick, ...pick.querySelectorAll('*')]) el.removeAttribute('style');
  const snap = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      cls: String(el.className||'').slice(0,70),
      beam: el.getAttribute('data-beam-icon'),
      text: (el.childNodes && [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue).join('')) || '',
      inner: (el.innerText||'').replace(/\\s+/g,' ').trim().slice(0,40),
      w: cs.width, h: cs.height, maxW: cs.maxWidth,
      mask: (cs.webkitMaskImage||cs.maskImage||'').slice(0,90),
      bg: cs.backgroundColor, fs: cs.fontSize, color: cs.color, opacity: cs.opacity,
    };
  };
  return {
    btn: snap(pick),
    maskEl: snap(pick.querySelector('[class*="newSessionLabelMask"]')),
    content: snap(pick.querySelector('[class*="newSessionContent"]')),
    label: snap(pick.querySelector('[class*="newSessionLabel"]')),
    svg: snap(pick.querySelector('svg')),
  };
})()`,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
