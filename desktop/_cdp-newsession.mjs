const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
if (!page) throw new Error("no page: " + JSON.stringify(pages).slice(0, 500));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
  ws.addEventListener("error", j);
});
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
function send(method, params = {}) {
  const mid = ++id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout " + method)), 8000);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
await send("Runtime.enable");
const res = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
  const btns = [...document.querySelectorAll('button,[role=button],[class*=newSession]')];
  const hits = btns.filter(b => /session|сесс|Ctrl|\\+|new/i.test((b.getAttribute('aria-label')||'')+' '+(b.innerText||'')+' '+(b.className||'')));
  const pick = hits.find(b => /newSession/i.test(String(b.className))) || hits[0] || null;
  if (!pick) return {error:'no button', count:btns.length, sample: btns.slice(0,8).map(b=>({cls:String(b.className).slice(0,80), aria:b.getAttribute('aria-label'), text:(b.innerText||'').slice(0,60)}))};
  const cs = getComputedStyle(pick);
  const kids = [...pick.querySelectorAll('*')].map(el => {
    const s = getComputedStyle(el);
    const ownText = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>JSON.stringify(n.nodeValue)).join(' ');
    return {
      tag: el.tagName,
      cls: String(el.className||'').slice(0,120),
      ownText,
      beam: el.getAttribute('data-beam-icon'),
      display: s.display,
      visibility: s.visibility,
      opacity: s.opacity,
      color: s.color,
      fontSize: s.fontSize,
      maxWidth: s.maxWidth,
      width: s.width,
      height: s.height,
      mask: (s.webkitMaskImage || s.maskImage || '').slice(0,120),
      bg: s.backgroundColor,
      overflow: s.overflow,
    };
  });
  return {
    cls: String(pick.className),
    aria: pick.getAttribute('aria-label'),
    beam: pick.getAttribute('data-beam-icon'),
    text: pick.innerText,
    html: pick.innerHTML.slice(0,1200),
    color: cs.color,
    fontSize: cs.fontSize,
    kids,
  };
})()`,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
