import fs from "node:fs";
const base =
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/dist/Beam Agent/resources/app/dsh/node_modules/@deepseek-ai/";
const files = [
  "dsh-client-ui-conversation/lib/client.js",
  "dsh-client-ui-settings-models/lib/client.js",
  "dsh-client-ui-brand-official/lib/client.js",
  "dsh-client-ui-sidebar-right/lib/client.js",
  "dsh-client-ui-sidebar/lib/client.js",
];
for (const f of files) {
  const p = base + f;
  if (!fs.existsSync(p)) {
    console.log(f, "MISSING");
    continue;
  }
  const s = fs.readFileSync(p, "utf8");
  console.log(
    f,
    "len",
    s.length,
    "Beam-ai",
    (s.match(/@Beam/g) || []).length,
    "deepseek-ai",
    (s.match(/@deepseek-ai/g) || []).length,
    "syntax-ish unmatched",
    (s.match(/\bBeamseek\b/g) || []).length
  );
}

// Try to extract fuller boot error via CDP
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
    const err = [];
    const orig = console.error;
    // peek last error from boot hint if rendered
    const fails = [...document.querySelectorAll("*")].filter(e => /failed|import|not loaded/i.test(e.innerText||"") && (e.innerText||"").length < 2000).map(e => e.innerText.slice(0,500));
    return fails.slice(0, 10);
  })()`,
  returnByValue: true,
});
console.log("fails", JSON.stringify(res.result?.result?.value, null, 2));
ws.close();
