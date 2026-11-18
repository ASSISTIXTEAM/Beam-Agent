const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page") || pages[0];
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
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    const t = setTimeout(() => reject(new Error("timeout " + method)), 20000);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
const res = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const side = document.getElementById("beam-side-limits");
    const auth = document.getElementById("beam-auth-gate");
    return {
      title: document.title,
      bodyLen: (document.body?.innerText || "").length,
      side: !!side,
      sideHtml: side ? side.innerHTML.slice(0, 300) : null,
      authHidden: auth ? auth.hidden : null,
      hasOpenLimits: [...document.scripts].some((s) => (s.textContent || "").includes("openLimitsModal")),
      hasOverride: !!document.querySelector('link[href*="beam-override"]'),
      footAreas: [...document.querySelectorAll('[class*="footArea"], [class*="settingsArea"]')].length,
      textSample: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 400),
    };
  })()`,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
