const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page") || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", () => r());
  ws.addEventListener("error", (e) => j(e.error || e));
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
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    const t = setTimeout(() => reject(new Error("timeout " + method)), 20000);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
const ev = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true });
  return res.result?.result?.value;
};
await new Promise((r) => setTimeout(r, 2500));
await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
await new Promise((r) => setTimeout(r, 400));
const click = await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    /Tide|Flare|Pine|Выбрать модель|Select model/i.test((x.innerText || '') + (x.getAttribute('aria-label') || ''))
  );
  if (!b) return null;
  b.click();
  return (b.innerText || '').trim();
})()`);
await new Promise((r) => setTimeout(r, 1000));
const info = await ev(`(() => {
  const texts = [...document.querySelectorAll('[role=menuitemradio], [role=menuitem], button')]
    .map((el) => (el.innerText || '').trim().split('\\n')[0])
    .filter((t) => /^(Tide|Flare|Pine)$/i.test(t));
  const headers = [...document.querySelectorAll('[role=menu] *')]
    .map((el) => (el.childNodes[0]?.nodeValue || '').trim())
    .filter((t) => /^(Beam|ASSISTIX|Kumo|assistix)/i.test(t));
  return {
    click,
    texts,
    counts: Object.fromEntries(['Tide','Flare','Pine'].map((n) => [n, texts.filter((x) => x === n).length])),
    headers: [...new Set(headers)],
    menuSlice: (document.querySelector('[role=menu]')?.innerText || '').slice(0, 500),
  };
})()`);
console.log(JSON.stringify(info, null, 2));
ws.close();
