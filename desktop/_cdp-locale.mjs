const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
if (!page) throw new Error("no page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", () => r()));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
});
function send(method, params = {}) {
  const mid = ++id;
  return new Promise((resolve) => {
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
await send("Runtime.enable");
await new Promise((r) => setTimeout(r, 1500));
const r = await send("Runtime.evaluate", {
  expression: `(() => {
    const buttons = [...document.querySelectorAll("button")].map(b => ({
      t: (b.innerText||"").trim().slice(0,40),
      hide: b.style.display === "none"
    })).filter(x => /update|更新|中文|English|Русский|Language|Язык/i.test(x.t));
    return {
      lang: document.documentElement.lang,
      title: document.title,
      buttons,
      hasZh: /中文/.test(document.body.innerText||""),
      snippet: (document.body.innerText||"").slice(0,250)
    };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(r.result?.result?.value, null, 2));
ws.close();
