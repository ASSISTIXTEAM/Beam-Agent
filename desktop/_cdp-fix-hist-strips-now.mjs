/** Live-kill left dashes + hot-reload right-only script into the running app. */
const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page" && String(p.url).includes("beam-app://app"));
if (!page) {
  console.log("no live page — filesystem patch only");
  process.exit(0);
}
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
await send("Page.enable");

const killed = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    document.getElementById("beam-hist-rail")?.remove();
    document.getElementById("beam-hist-peek")?.remove();
    document.documentElement.removeAttribute("data-beam-hist-scrub");
    for (const el of document.querySelectorAll(".beam-hist-strip")) el.remove();
    // neutralize old v1 if still somehow polling
    window.__beamHistStrips = true;
    return {
      railGone: !document.getElementById("beam-hist-rail"),
      peekGone: !document.getElementById("beam-hist-peek"),
      stripCount: document.querySelectorAll(".beam-hist-strip").length,
      sessionRows: document.querySelectorAll('[class*="sessionRow"]').length,
      rightMarks: document.querySelectorAll('[data-conversation-scroll] [class*="_mark"]').length,
      rightFrame: !!document.querySelector('[data-conversation-scroll] [class*="_frame"]'),
    };
  })()`,
});
console.log("killed", JSON.stringify(killed.result?.result?.value ?? killed, null, 2));

await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 5500));

const after = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => ({
    v2: !!window.__beamHistStripsV2,
    script: !!document.getElementById("beam-history-strips"),
    railGone: !document.getElementById("beam-hist-rail"),
    leftStrips: document.querySelectorAll(".beam-hist-strip").length,
    sessionRows: document.querySelectorAll('[class*="sessionRow"]').length,
    rightMarks: document.querySelectorAll('[data-conversation-scroll] [class*="_mark"]').length,
    rightFrame: !!document.querySelector('[data-conversation-scroll] [class*="_frame"]'),
    bootText: (document.body?.innerText || "").slice(0, 120),
  }))()`,
});
console.log("after reload", JSON.stringify(after.result?.result?.value ?? after, null, 2));
ws.close();
