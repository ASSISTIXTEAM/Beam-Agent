const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
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
const click = await send("Runtime.evaluate", {
  expression: `(() => {
    const btns = [...document.querySelectorAll("button,[role=button],div")];
    const target = btns.find(b => /Select model/i.test(b.innerText||"") && (b.innerText||"").length < 40);
    if (!target) return { ok:false, texts: btns.map(b=>(b.innerText||"").slice(0,40)).filter(Boolean).slice(0,40) };
    target.click();
    return { ok:true, text:(target.innerText||"").slice(0,80) };
  })()`,
  returnByValue: true,
});
console.log("click", JSON.stringify(click.result?.result?.value));
await new Promise((r) => setTimeout(r, 800));
const menu = await send("Runtime.evaluate", {
  expression: `(() => {
    const items = [...document.querySelectorAll("[role=menuitem], [role=option], li, button")].map(e => (e.innerText||"").trim()).filter(t => t && t.length < 120);
    return [...new Set(items)].slice(0, 60);
  })()`,
  returnByValue: true,
});
console.log("menu", JSON.stringify(menu.result?.result?.value, null, 2));
const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync(
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/_ui-models.png",
  Buffer.from(shot.result.data, "base64")
);
ws.close();
