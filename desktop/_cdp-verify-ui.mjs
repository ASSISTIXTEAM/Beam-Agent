/** CDP: assert Beam UI mounts past splash — sidebar/composer, no crash, no eternal Loading. */
const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
console.log("pages", pages.map((p) => ({ type: p.type, url: p.url, title: p.title })));
const page =
  pages.find((p) => p.type === "page" && /beam-app:\/\/app/i.test(p.url || "")) ||
  pages.find((p) => p.type === "page") ||
  pages[0];
if (!page?.webSocketDebuggerUrl) {
  console.error("NO_PAGE");
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", () => r());
  ws.addEventListener("error", (e) => j(e.error || e));
});
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
    errors.push((msg.params.args || []).map((a) => a.value ?? a.description).join(" ").slice(0, 400));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push(String(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || "").slice(0, 400));
  }
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

let best = null;
for (let i = 0; i < 50; i++) {
  const res = await send("Runtime.evaluate", {
    expression: `(() => {
      const body = (document.body && document.body.innerText) || "";
      const root = document.getElementById("root");
      const title = document.title || "";
      const href = location.href;
      const loadingOnly = /^\\s*(BEAM\\s*)?(Loading Beam Agent…?|Beam Agent)\\s*$/i.test(body.trim())
        && !!document.querySelector("[data-dsh-boot]:not([hidden]), [data-beam-boot]:not([hidden]), #beam-early-splash:not([hidden])");
      const hasSidebar = !!document.querySelector('[data-sidebar], aside, [class*="sidebar" i], [data-shell-overlay]');
      const hasComposer = !!document.querySelector('textarea, [contenteditable="true"], [role="textbox"]');
      const crash = /недоступен|unavailable|stayed blank|fatalSummary/i.test(body + title);
      return {
        href, title, bodyLen: body.trim().length,
        rootChildren: root ? root.childElementCount : -1,
        hasSidebar, hasComposer, crash, loadingOnly,
        snippet: body.replace(/\\s+/g, " ").trim().slice(0, 220),
      };
    })()`,
    returnByValue: true,
  });
  best = res.result?.result?.value ?? res;
  console.log("try", i, JSON.stringify(best));
  if (best?.crash) {
    console.error("CRASH_UI", best);
    console.error("errors", errors.slice(-5));
    ws.close();
    process.exit(2);
  }
  if (best && !best.loadingOnly && best.bodyLen > 40 && (best.hasSidebar || best.hasComposer || best.rootChildren > 2)) {
    console.log("UI_OK");
    console.log("recentErrors", errors.slice(-3));
    ws.close();
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.error("UI_FAIL", best);
console.error("errors", errors.slice(-8));
ws.close();
process.exit(1);
