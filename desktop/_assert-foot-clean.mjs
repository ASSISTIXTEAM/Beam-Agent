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
    const t = setTimeout(() => reject(new Error("timeout " + method)), 15000);
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
    const modal = document.getElementById("beam-profile-modal");
    if (modal) modal.hidden = true;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const side = document.getElementById("beam-side-limits");
    const more = [...document.querySelectorAll("button,[role=button]")].filter((e) => {
      const label = ((e.innerText || "") + " " + (e.getAttribute("aria-label") || "")).trim();
      if (!/(^|\\s)(Ещё|More)(\\s|$)/i.test(label) && !/^(Ещё|More)$/i.test((e.innerText || "").trim())) return false;
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.height > 4 && r.width > 4 && s.opacity !== "0" && s.display !== "none" && s.visibility !== "hidden";
    }).map((e) => {
      const r = e.getBoundingClientRect();
      return { t: (e.innerText || "").trim(), y: Math.round(r.y), h: Math.round(r.height), inFoot: !!e.closest('[class*="footArea"],[class*="settingsArea"],#beam-side-limits') };
    });
    return {
      sideText: (side?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 200),
      moreVisible: more,
      hasLogoutNode: !!side?.querySelector(".bsl-logout"),
      hasXChar: /✕/.test(side?.innerHTML || ""),
      gear: !!side?.querySelector(".bsl-gear"),
      foot: !!side?.querySelector(".bsl-foot-row"),
      profileAct: side?.querySelector(".bsl-profile")?.getAttribute("data-act"),
    };
  })()`,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
