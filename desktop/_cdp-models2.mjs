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
// click the specific Select model control at bottom
await send("Runtime.evaluate", {
  expression: `(() => {
    const all = [...document.querySelectorAll("button, [role=button], span, div")];
    const candidates = all.filter(e => (e.innerText||"").trim() === "Select model");
    const el = candidates[candidates.length-1] || all.find(e => /Select model/i.test(e.innerText||"") && (e.innerText||"").length < 20);
    if (!el) return {ok:false};
    el.click();
    return {ok:true, tag: el.tagName, text: el.innerText};
  })()`,
  returnByValue: true,
});
await new Promise((r) => setTimeout(r, 1000));
const menu = await send("Runtime.evaluate", {
  expression: `(() => {
    const nodes = [...document.querySelectorAll("[role=menu] *, [role=listbox] *, [data-radix-menu-content] *, [class*=menu] *, [class*=Menu] *, [class*=popover] *, [class*=Popover] *")];
    const texts = nodes.map(n => (n.innerText||"").trim()).filter(t => t && t.length < 80);
    const uniq = [...new Set(texts)];
    return { uniq: uniq.slice(0, 80), count: uniq.length };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(menu.result?.result?.value, null, 2));
const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync("C:/Users/Alexa/OneDrive/Documents/Beam Agent/_ui-picker.png", Buffer.from(shot.result.data, "base64"));
ws.close();
