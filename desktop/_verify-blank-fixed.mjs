const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pages, page;
for (let i = 0; i < 35; i++) {
  try {
    pages = await (await fetch("http://127.0.0.1:9229/json")).json();
    page =
      pages.find((p) => p.type === "page" && String(p.url || "").includes("beam-app://")) ||
      pages.find((p) => p.type === "page");
    if (page?.webSocketDebuggerUrl) break;
  } catch {}
  await sleep(1000);
}
if (!page?.webSocketDebuggerUrl) {
  console.log(JSON.stringify({ error: "no page", pages }, null, 2));
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
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
const send = (method, params = {}, timeoutMs = 25000) =>
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
let last = null;
for (let i = 0; i < 45; i++) {
  const res = await send("Runtime.evaluate", {
    expression: `(() => {
      const root = document.getElementById("root");
      const text = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
      return {
        href: location.href,
        title: document.title,
        bodyLen: text.length,
        rootChildren: root?.childElementCount ?? -1,
        hasOverlay: !!document.querySelector("[data-shell-overlay]"),
        hasComposer: !!document.querySelector("textarea,[contenteditable], [role=textbox]"),
        snippet: text.slice(0, 280),
      };
    })()`,
    returnByValue: true,
  });
  last = res.result?.result?.value ?? res;
  console.log("try", i, "bodyLen", last?.bodyLen, "root", last?.rootChildren, "href", last?.href);
  if ((last?.bodyLen || 0) > 40 && (last?.rootChildren || 0) > 0) break;
  await sleep(1000);
}
console.log(JSON.stringify(last, null, 2));
const ok =
  (last?.bodyLen || 0) > 40 &&
  (last?.rootChildren || 0) > 0 &&
  String(last?.href || "").startsWith("beam-app://");
ws.close();
process.exit(ok ? 0 : 2);
