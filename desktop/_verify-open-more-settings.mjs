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
const evalExpr = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true });
  return res.result?.result?.value;
};

// Click first short "Ещё" in sidebar
console.log(
  "more",
  await evalExpr(`(() => {
    const els = [...document.querySelectorAll("button,[role=button]")].filter((e) =>
      /^(Ещё|More)$/i.test((e.innerText || "").trim())
    );
    const el = els[0];
    if (!el) return { count: els.length };
    el.click();
    return { clicked: true, text: (el.innerText || "").trim() };
  })()`),
);
await new Promise((r) => setTimeout(r, 800));
console.log(
  "menu",
  await evalExpr(`(() => {
    return [...document.querySelectorAll("[role=menuitem],button,a")]
      .map((e) => (e.innerText || "").trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 40);
  })()`),
);
const settings = await evalExpr(`(() => {
  const el = [...document.querySelectorAll("[role=menuitem],button,a")].find((e) =>
    /настрой|settings|preferences/i.test(e.innerText || "")
  );
  if (!el) return null;
  el.click();
  return (el.innerText || "").trim();
})()`);
console.log("settings", settings);
await new Promise((r) => setTimeout(r, 1500));
const limits = await evalExpr(`(() => {
  const el = [...document.querySelectorAll("button,[role=tab],a")].find((e) =>
    /^(Лимиты|Limits|Models|Модели)$/i.test((e.innerText || "").trim().split("\\n")[0])
  );
  if (el) { el.click(); return (el.innerText || "").trim(); }
  return [...document.querySelectorAll("button,[role=tab]")].map((e) => (e.innerText || "").trim().slice(0, 40)).filter(Boolean).slice(0, 30);
})()`);
console.log("limits nav", limits);
await new Promise((r) => setTimeout(r, 2000));
console.log(
  "body",
  await evalExpr(`(() => {
    const t = document.body.innerText || "";
    return {
      hasTide: /\\bTide\\b/.test(t),
      hasFlare: /\\bFlare\\b/.test(t),
      hasPine: /\\bPine\\b/.test(t),
      hasOfficial: /assistix-official|ASSISTIX Official|\\bKumo\\b/i.test(t),
      loading: /Загрузка моделей|Обновление списка/i.test(t),
      blp: !!document.getElementById("beam-limits-panel"),
      snippet: t.replace(/\\s+/g, " ").slice(0, 1200),
    };
  })()`),
);
ws.close();
