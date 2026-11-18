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
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};

// Open settings via common shortcuts / buttons
const opened = await evalExpr(`(() => {
  const btn = [...document.querySelectorAll("button,[role=button],a")].find((e) =>
    /настрой|settings|preferences/i.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || ""))
  );
  if (btn) { btn.click(); return "clicked:" + ((btn.innerText || btn.getAttribute("aria-label") || "").trim().slice(0, 40)); }
  // try Ctrl+,
  document.dispatchEvent(new KeyboardEvent("keydown", { key: ",", ctrlKey: true, bubbles: true }));
  return "hotkey";
})()`);
console.log("open settings", opened);
await new Promise((r) => setTimeout(r, 1200));

const nav = await evalExpr(`(() => {
  const btn = [...document.querySelectorAll("button,[role=tab],a")].find((e) =>
    /^(Models|Модели|Limits|Лимиты)$/i.test((e.innerText || "").trim().split("\\n")[0].trim())
  );
  if (btn) { btn.click(); return (btn.innerText || "").trim().slice(0, 40); }
  return [...document.querySelectorAll("button,[role=tab]")].slice(0, 20).map((e) => (e.innerText || "").trim().slice(0, 40));
})()`);
console.log("nav", nav);
await new Promise((r) => setTimeout(r, 2000));

const body = await evalExpr(`(() => {
  const t = document.body.innerText || "";
  return {
    hasTide: /\\bTide\\b/.test(t),
    hasFlare: /\\bFlare\\b/.test(t),
    hasPine: /\\bPine\\b/.test(t),
    hasOfficial: /assistix-official|ASSISTIX Official|\\bKumo\\b/i.test(t),
    loading: /Загрузка моделей|Обновление списка моделей/i.test(t),
    snippet: t.replace(/\\s+/g, " ").slice(0, 1000),
  };
})()`);
console.log(JSON.stringify(body, null, 2));

// Confirm patched catalog code is present in loaded module graph (string probe)
const codeProbe = await evalExpr(`(() => {
  try {
    const scripts = [...document.querySelectorAll("script")].map((s) => s.src).filter(Boolean);
    return { scripts: scripts.slice(0, 8), hasStrip: !!window }; 
  } catch (e) { return String(e); }
})()`);
console.log("probe", codeProbe);

// Probe side limits rings (Tide/Flare/Pine always in injector)
const rings = await evalExpr(`(() => {
  const el = document.getElementById("beam-side-limits");
  if (!el) return null;
  return [...el.querySelectorAll("[data-id]")].map((n) => n.getAttribute("data-id"));
})()`);
console.log("side rings", rings);
ws.close();
