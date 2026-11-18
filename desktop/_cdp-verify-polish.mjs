const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
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
function send(method, params = {}, timeoutMs = 20000) {
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
await new Promise((r) => setTimeout(r, 1500));
const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const profile = document.getElementById("beam-assistix-profile");
    const text = document.body?.innerText || "";
    return {
      title: document.title,
      hasOverride: !!document.querySelector('link[href*="beam-override"]'),
      profile: profile ? profile.innerText.slice(0, 500) : null,
      deepHits: (text.match(/DeepSeek|Harness|Custom model API|API key/gi) || []).slice(0, 20),
      hasTide: /Tide/i.test(text),
      hasBuild: /Build with Beam/i.test(text),
      bg: getComputedStyle(document.documentElement).backgroundColor || getComputedStyle(document.body).backgroundColor,
      imgs: [...document.querySelectorAll("img")].slice(0, 5).map((i) => i.alt),
    };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value, null, 2));
const shot = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync(
  "C:/Users/Alexa/OneDrive/Documents/Beam Agent/_ui-polish.png",
  Buffer.from(shot.result.data, "base64")
);
console.log("shot saved");
ws.close();
