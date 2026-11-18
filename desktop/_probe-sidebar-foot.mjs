const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
console.log(JSON.stringify(pages.map((p) => ({ title: p.title, type: p.type, url: p.url })), null, 2));
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
const send = (method, params = {}, timeoutMs = 20000) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    const t = setTimeout(() => reject(new Error("timeout " + method)), timeoutMs);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
await send("Page.enable");
const tree = await send("Page.getFrameTree");
console.log("frames", JSON.stringify(tree.result?.frameTree || tree, null, 2).slice(0, 2000));
const evalExpr = async (expression, contextId) => {
  const params = { expression, returnByValue: true };
  if (contextId != null) params.contextId = contextId;
  const res = await send("Runtime.evaluate", params);
  return res.result?.result?.value ?? res.result;
};
console.log(
  "html",
  await evalExpr(`({
    htmlLen: document.documentElement?.outerHTML?.length || 0,
    childCount: document.body?.childElementCount || 0,
    htmlHead: (document.documentElement?.outerHTML || "").slice(0, 500),
    scripts: [...document.scripts].map(s => s.src || 'inline').slice(0, 10),
    root: !!document.getElementById('root'),
    rootHtml: (document.getElementById('root')?.innerHTML || '').slice(0, 200),
  })`),
);
ws.close();
