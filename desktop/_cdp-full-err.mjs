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
  if (msg.method === "Runtime.consoleAPICalled") {
    const a = (msg.params.args || []).map((x) => x.value ?? x.description).join(" ");
    if (/error|fail|not loaded|boot/i.test(a)) logs.push(a.slice(0, 2000));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    logs.push(
      "EXC " +
        (msg.params.exceptionDetails?.exception?.description ||
          msg.params.exceptionDetails?.text ||
          "")
    );
  }
});
function send(method, params = {}, timeoutMs = 30000) {
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
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 12000));
console.log("---LOGS---");
for (const l of logs) console.log(l, "\n---\n");
const state = await send("Runtime.evaluate", {
  expression: `(document.body?.innerText||"").slice(0,800)`,
  returnByValue: true,
});
console.log("text", state.result?.result?.value);
ws.close();
