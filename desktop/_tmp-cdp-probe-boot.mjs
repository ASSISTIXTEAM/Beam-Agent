const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const t = targets.find((x) => x.type === "page");
if (!t) {
  console.error("no page target");
  process.exit(2);
}
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
  ws.addEventListener("error", j);
});
let id = 0;
const pending = new Map();
const consoleMsgs = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  if (m.method === "Runtime.consoleAPICalled") {
    const args = (m.params?.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
    consoleMsgs.push({ type: m.params?.type, args: String(args).slice(0, 500) });
  }
  if (m.method === "Log.entryAdded") {
    consoleMsgs.push({ type: "log", args: String(m.params?.entry?.text || "").slice(0, 500) });
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await send("Runtime.enable");
await send("Console.enable");
await send("Log.enable");
const ev = await send("Runtime.evaluate", {
  expression: `(() => {
  const root = document.querySelector("#root");
  const text = (root?.innerText || document.body?.innerText || "").slice(0, 800);
  return {
    url: location.href,
    text,
    bootEls: [...document.querySelectorAll("[data-beam-boot],[data-dsh-boot]")].map((e) => ({
      tag: e.tagName,
      hidden: e.hidden,
      html: e.outerHTML.slice(0, 220),
    })),
    buttons: document.querySelectorAll("button").length,
    hasDialog: /unavailable|could not start|webServer|connection/i.test(document.body?.innerText || ""),
    globals: {
      dshDesktopBoot: typeof globalThis.dshDesktopBoot,
      beamDesktopBoot: typeof globalThis.beamDesktopBoot,
      __DSH_BOOT__: typeof window.__DSH_BOOT__,
      __beamBootCapFired: !!window.__beamBootCapFired,
    },
    scripts: [...document.scripts].slice(0, 25).map((s) => s.src || s.id || "inline"),
  };
})()`,
  returnByValue: true,
});
console.log(JSON.stringify(ev.result?.result?.value ?? ev, null, 2));
await new Promise((r) => setTimeout(r, 500));
console.log("console", JSON.stringify(consoleMsgs.slice(-30), null, 2));
ws.close();
