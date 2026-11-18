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
    const t = setTimeout(() => reject(new Error("timeout " + method)), 30000);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
let last = null;
for (let i = 0; i < 60; i++) {
  const res = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => ({
      bodyLen: (document.body?.innerText || "").length,
      side: !!document.getElementById("beam-side-limits"),
      foot: [...document.querySelectorAll('[class*="footArea"]')].length,
      sample: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 160),
    }))()`,
  });
  last = res.result?.result?.value;
  console.log("try", i, { bodyLen: last?.bodyLen, side: last?.side, foot: last?.foot });
  if (last?.side || (last?.bodyLen || 0) > 80) break;
  await new Promise((r) => setTimeout(r, 2000));
}
console.log("final", last);
ws.close();
if (!last?.side && (last?.bodyLen || 0) < 80) process.exit(1);
