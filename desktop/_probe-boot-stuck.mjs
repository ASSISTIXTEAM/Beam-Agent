const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page =
  pages.find((p) => p.type === "page" && String(p.url || "").includes("beam-app://")) ||
  pages.find((p) => p.type === "page");
if (!page?.webSocketDebuggerUrl) {
  console.log(JSON.stringify(pages, null, 2));
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
await send("Log.enable").catch(() => {});
const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const out = {
      href: location.href,
      text: (document.body?.innerText || "").slice(0, 200),
      hasModuleLoader: typeof window.__ModuleLoader__ !== "undefined",
      moduleMode: window.__ModuleLoader__?.mode,
      pendingQueue: window.__ModuleLoader__?.pendingQueue?.length,
      hasBoot: typeof window.__DSH_BOOT__ !== "undefined",
      hasBootReady: typeof globalThis.__DSH_BOOT_READY__ !== "undefined",
      hasDesktopBoot: typeof window.dshDesktopBoot !== "undefined",
      scripts: [...document.scripts].map(s => s.src || "(inline)").slice(0, 20),
      preloads: [...document.querySelectorAll('link[rel=modulepreload],link[rel=preload]')].map(l => l.href).slice(0, 20),
    };
    return out;
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));

// Try invoking boot readiness / catch errors
const boot = await send("Runtime.evaluate", {
  expression: `(() => {
    try {
      return {
        bootReadyType: typeof globalThis.__DSH_BOOT_READY__,
        keys: Object.keys(globalThis).filter(k => /DSH|Module|dsh/i.test(k)).slice(0, 40),
      };
    } catch (e) { return { err: String(e) }; }
  })()`,
  returnByValue: true,
});
console.log("bootmeta", JSON.stringify(boot.result?.result?.value ?? boot, null, 2));

// Network: try fetch a plugin path through page
const net = await send("Runtime.evaluate", {
  expression: `(async () => {
    try {
      if (!window.dshDesktopBoot) return { no: "dshDesktopBoot" };
      const ready = await Promise.race([
        window.dshDesktopBoot.ready(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("boot-timeout")), 8000)),
      ]);
      return { ok: true, inj: (ready?.injections || []).length, stream: ready?.streamBaseUrl };
    } catch (e) {
      return { ok: false, err: String(e) };
    }
  })()`,
  returnByValue: true,
  awaitPromise: true,
});
console.log("desktopBoot", JSON.stringify(net.result?.result?.value ?? net, null, 2));
ws.close();
