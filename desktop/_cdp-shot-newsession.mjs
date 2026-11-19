import fs from "node:fs";
const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
if (!page) throw new Error("no page");
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
await send("Page.enable");
const clipInfo = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const b = document.querySelector('button.wtg9ga_newSession, button[class*="newSession"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(r.width + 16, 420), height: Math.min(r.height + 16, 80), dpr: window.devicePixelRatio || 1 };
  })()`,
});
const clip = clipInfo.result?.result?.value;
const shot = await send("Page.captureScreenshot", clip
  ? { format: "png", clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 }, fromSurface: true }
  : { format: "png", fromSurface: true });
const b64 = shot.result?.data;
if (!b64) throw new Error("no shot " + JSON.stringify(shot).slice(0, 300));
const out = "C:/Beam-Agent/assets/_ui-newsession-fix.png";
fs.writeFileSync(out, Buffer.from(b64, "base64"));
console.log("wrote", out, "clip", clip);
ws.close();
