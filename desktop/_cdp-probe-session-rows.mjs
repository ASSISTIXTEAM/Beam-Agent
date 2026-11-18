const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page" && String(p.url).includes("beam-app://app"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
  ws.addEventListener("error", j);
});
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
await new Promise((r) => setTimeout(r, 6000));
const res = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const allTree = [...document.querySelectorAll('[role="treeitem"]')].slice(0, 15).map((el) => ({
      key: el.getAttribute("data-row-key"),
      cls: String(el.className).slice(0, 90),
      text: (el.textContent || "").trim().slice(0, 50),
    }));
    const sessionLike = [...document.querySelectorAll('[class*="sessionRow"], [data-row-key]')].slice(0, 15).map((el) => ({
      key: el.getAttribute("data-row-key"),
      cls: String(el.className).slice(0, 90),
      role: el.getAttribute("role"),
      text: (el.textContent || "").trim().slice(0, 50),
    }));
    return {
      treeCount: document.querySelectorAll('[role="treeitem"]').length,
      sessionRowCount: document.querySelectorAll('[class*="sessionRow"]').length,
      dataRowKeyCount: document.querySelectorAll("[data-row-key]").length,
      allTree,
      sessionLike,
      gate: !!document.getElementById("beam-auth-gate"),
      hasScript: !!document.getElementById("beam-history-strips"),
      bodySample: (document.body.innerText || "").slice(0, 240),
    };
  })()`,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
