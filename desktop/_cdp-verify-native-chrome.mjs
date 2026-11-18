import fs from "node:fs";

const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page") || pages[0];
if (!page?.webSocketDebuggerUrl) throw new Error("no CDP page");
console.log("page meta", { title: page.title, url: page.url });

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
const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const text = (document.body && document.body.innerText || "").replace(/\\s+/g, " ").trim();
    const title = document.title;
    const href = location.href;
    const hitLocal = /localhost|127\\.0\\.0\\.1|\\[::1\\]/i.test(title + "\\n" + href + "\\n" + text.slice(0, 2000));
    const visibleLocal = [];
    for (const el of document.querySelectorAll("body *")) {
      let own = "";
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && /localhost|127\\.0\\.0\\.1/i.test(n.nodeValue || "")) own += n.nodeValue;
      }
      if (own && el.offsetParent !== null) visibleLocal.push(own.trim().slice(0, 80));
      if (visibleLocal.length >= 10) break;
    }
    const host = document.querySelector("[data-windows-menu]");
    const windowsMenuLabels = host && host.shadowRoot
      ? [...host.shadowRoot.querySelectorAll("button")].map((b) => b.textContent)
      : [];
    return {
      title,
      href,
      hitLocal,
      visibleLocal,
      bodyLen: text.length,
      bodySnippet: text.slice(0, 180),
      hasWindowsMenu: !!host,
      windowsMenuLabels,
    };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));

const shot = await send("Page.captureScreenshot", { format: "png" });
if (shot.result?.data) {
  fs.writeFileSync("desktop/_shot-native-chrome.png", Buffer.from(shot.result.data, "base64"));
  console.log("wrote desktop/_shot-native-chrome.png");
}
ws.close();
