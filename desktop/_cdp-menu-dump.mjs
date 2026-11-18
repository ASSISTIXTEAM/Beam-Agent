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
    const t = setTimeout(() => reject(new Error("timeout " + method)), 25000);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
const ev = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails };
  return res.result?.result?.value;
};
await new Promise((r) => setTimeout(r, 1500));
for (let i = 0; i < 2; i++) {
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await new Promise((r) => setTimeout(r, 200));
}
const out = await ev(`(() => {
  const trigger = [...document.querySelectorAll('button')].find((b) =>
    /Tide|Flare|Pine/i.test((b.innerText || '') + (b.getAttribute('aria-label') || ''))
  );
  if (!trigger) return { err: 'no trigger' };
  trigger.click();
  return { trigger: (trigger.innerText || '').trim(), aria: trigger.getAttribute('aria-label') };
})()`);
await new Promise((r) => setTimeout(r, 1200));
const dump = await ev(`(() => {
  const menus = [...document.querySelectorAll('[role=menu], [class*="_9r0rkG_menu"], [class*="Menu"]')];
  return {
    menuCount: menus.length,
    menus: menus.map((m) => ({
      role: m.getAttribute('role'),
      text: (m.innerText || '').slice(0, 1000),
      radios: [...m.querySelectorAll('[role=menuitemradio]')].map((el) => (el.innerText || '').trim()),
      items: [...m.querySelectorAll('[role=menuitem], [role=menuitemradio], button')].map((el) => ({
        role: el.getAttribute('role'),
        text: (el.innerText || '').trim().slice(0, 80),
      })).slice(0, 30),
    })),
    allRadios: [...document.querySelectorAll('[role=menuitemradio]')].map((el) => (el.innerText || '').trim()),
  };
})()`);
console.log(JSON.stringify({ out, dump }, null, 2));
ws.close();
