const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
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
const res = await send("Runtime.evaluate", {
  expression: `(() => {
    // pull failure text from boot UI if present
    const boot = document.querySelector("[data-dsh-boot]");
    return {
      bootText: boot?.innerText || null,
      card: document.querySelector("[class*=card]")?.innerText || null,
      all: (document.body?.innerText || "").slice(0, 5000),
    };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value, null, 2));
ws.close();
