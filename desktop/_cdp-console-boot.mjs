const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page" && String(p.url).includes("beam-app://app"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
  ws.addEventListener("error", j);
});
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
  if (msg.method === "Runtime.consoleAPICalled") {
    const args = (msg.params?.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
    logs.push((msg.params?.type || "log") + ": " + args.slice(0, 200));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    logs.push("exception: " + String(msg.params?.exceptionDetails?.text || "").slice(0, 200));
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
await send("Console.enable");
await new Promise((r) => setTimeout(r, 2000));
const res = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => ({
    text: (document.body?.innerText || "").slice(0, 300),
    rootKids: document.getElementById("root")?.childElementCount ?? -1,
    scripts: [...document.scripts].map((s) => s.id || (s.src || "").slice(-40)).slice(0, 12),
    hist: !!window.__beamHistStrips,
  }))()`,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
console.log("logs", logs.slice(-20));
ws.close();
