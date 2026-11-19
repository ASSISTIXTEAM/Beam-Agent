const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
if (!page) throw new Error("no page");
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
function send(method, params = {}, timeoutMs = 15000) {
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
await send("Runtime.enable");
const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const text = (document.body?.innerText || "").slice(0, 4000);
    const deep = [...(text.match(/DeepSeek|Harness|whale|Custom|API Key|Assistix|Tide|Flare|Pine|Select model|provider/gi) || [])];
    const counts = {};
    for (const d of deep) counts[d] = (counts[d]||0)+1;
    return {
      title: document.title,
      counts,
      snippet: text.slice(0, 2000),
      imgs: [...document.querySelectorAll("img")].slice(0,8).map(i=>({alt:i.alt,src:(i.getAttribute("src")||"").slice(0,50)}))
    };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value, null, 2));
const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync(
  "C:/Beam-Agent/_ui-now.png",
  Buffer.from(shot.result.data, "base64")
);
ws.close();
