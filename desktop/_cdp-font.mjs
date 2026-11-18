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
function send(method, params = {}, timeoutMs = 20000) {
  const mid = ++id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout " + method)), timeoutMs);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 5000));
const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const body = getComputedStyle(document.body).fontFamily;
    const btn = document.querySelector("button");
    const btnFont = btn ? getComputedStyle(btn).fontFamily : null;
    const faces = document.fonts ? [...document.fonts].filter(f => /savona/i.test(f.family)).map(f => f.family + " " + f.weight + " " + f.status) : [];
    return { body, btnFont, faces: faces.slice(0, 25), faceCount: faces.length, hasOverride: !!document.querySelector('link[href*="beam-override"]') };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value, null, 2));
ws.close();
