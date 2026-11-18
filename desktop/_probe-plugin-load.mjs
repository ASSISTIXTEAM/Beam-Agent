const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page =
  pages.find((p) => p.type === "page" && String(p.url || "").includes("beam-app://")) ||
  pages.find((p) => p.type === "page");
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
const send = (method, params = {}, timeoutMs = 30000) =>
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
await send("Network.enable");

const evalRes = await send("Runtime.evaluate", {
  expression: `(async () => {
    const url = "beam-app://app/plugins/??@assistix/beam-client-modules/client.js&rev=f520b24dd474";
    try {
      const r = await fetch(url);
      const text = await r.text();
      return {
        status: r.status,
        type: r.headers.get("content-type"),
        len: text.length,
        head: text.slice(0, 200),
        hasLoad: text.includes("__ModuleLoader__") || text.includes("ModuleLoader"),
        hasFactory: /factory|createClientModuleSystem/.test(text.slice(0, 5000)),
      };
    } catch (e) {
      return { err: String(e) };
    }
  })()`,
  returnByValue: true,
  awaitPromise: true,
});
console.log("plugin fetch", JSON.stringify(evalRes.result?.result?.value ?? evalRes, null, 2));

const errs = await send("Runtime.evaluate", {
  expression: `(() => {
    // script error attributes
    const scripts = [...document.scripts].map(s => ({
      src: s.src || "(inline)",
      async: s.async,
      defer: s.defer,
      type: s.type,
      dataset: {...s.dataset},
    }));
    return {
      scripts,
      pending: window.__ModuleLoader__?.pendingQueue?.map?.(x => x?.id) || window.__ModuleLoader__?.pendingQueue?.length,
      mode: window.__ModuleLoader__?.mode,
    };
  })()`,
  returnByValue: true,
});
console.log("scripts", JSON.stringify(errs.result?.result?.value ?? errs, null, 2));

// Force reload once and watch console
await send("Page.reload", { ignoreCache: true }).catch(() => {});
ws.close();
console.log("reloaded");
