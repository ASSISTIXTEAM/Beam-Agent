import fs from "node:fs";
import path from "node:path";

const dist =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js";
const clean =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/_tmp_app/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js";

for (const [label, p] of [
  ["dist", dist],
  ["clean", clean],
]) {
  const buf = fs.readFileSync(p);
  const s = buf.toString("utf8");
  console.log(label, {
    bytes: buf.length,
    bom: buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf,
    head: JSON.stringify(s.slice(0, 80)),
    hasModuleLoader: s.includes("__ModuleLoader__"),
    hasExport: /export |module\\.exports|window\\.__ModuleLoader__/.test(s),
  });
}

// Restore brand-official clean too
fs.copyFileSync(
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/_tmp_app/dsh/node_modules/@deepseek-ai/dsh-client-ui-brand-official/lib/client.js",
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/dsh-client-ui-brand-official/lib/client.js"
);
console.log("brand-official restored clean");

// Try loading conversation via CDP fetch of dsh-app URL if possible
const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", () => r()));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
  if (msg.method === "Runtime.exceptionThrown") {
    logs.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    logs.push((msg.params.args || []).map((x) => x.value ?? x.description).join(" ").slice(0, 1500));
  }
});
function send(method, params = {}) {
  const mid = ++id;
  return new Promise((resolve) => {
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
await send("Runtime.enable");
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 10000));
console.log("errors", logs.slice(0, 15));
ws.close();
