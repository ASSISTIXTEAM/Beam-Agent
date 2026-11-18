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

console.log(
  "click workspace",
  await evalExpr(`(() => {
    const el = [...document.querySelectorAll("button,[role=button],a")].find((e) =>
      /Выбрать рабочую область|Choose workspace|Open/i.test((e.innerText || "").trim())
    );
    if (!el) return null;
    el.click();
    return (el.innerText || "").trim().slice(0, 80);
  })()`),
);
await new Promise((r) => setTimeout(r, 1500));

console.log(
  "picked",
  await evalExpr(`(() => {
    const rows = [...document.querySelectorAll("button,[role=option],[role=menuitem],li,div")].filter((e) =>
      /default-workspace|\\.beam|Beam Agent/i.test(e.innerText || "")
    );
    const hit = rows.find((e) => /default-workspace/i.test(e.innerText || "")) || rows[0];
    if (hit) {
      hit.click();
      return (hit.innerText || "").trim().slice(0, 120);
    }
    return rows.slice(0, 5).map((e) => (e.innerText || "").trim().slice(0, 80));
  })()`),
);
await new Promise((r) => setTimeout(r, 3000));

const state = await evalExpr(`(() => {
  const chips = [...document.querySelectorAll("button,[role=button]")].filter((el) =>
    /Beam Agent|Запись в рабочую|Workspace Write|рабоч/i.test(
      (el.innerText || "") + (el.getAttribute("aria-label") || ""),
    )
  );
  const chipInfo = chips.slice(0, 8).map((el) => {
    const svgs = [...el.querySelectorAll("svg")];
    return {
      text: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 70),
      beamIcon: el.getAttribute("data-beam-icon"),
      svgCount: svgs.length,
      folderMasks: svgs.filter((s) =>
        /folder/i.test(getComputedStyle(s).webkitMaskImage || getComputedStyle(s).maskImage || ""),
      ).length,
    };
  });
  const loading = [...document.querySelectorAll("button,span")]
    .map((e) => (e.innerText || "").trim())
    .filter((t) => /Загрузка моделей|Обновление списка|Loading models/i.test(t))
    .slice(0, 8);
  const models = [...document.querySelectorAll("[data-model-id]")].map((el) => ({
    id: el.getAttribute("data-model-id"),
    text: (el.textContent || "").trim(),
    color: getComputedStyle(el).color,
  }));
  const trigger = [...document.querySelectorAll("button")].find((b) =>
    /Tide|Flare|Pine|Загрузка моделей|Выбрать модель|Select model|Loading models/i.test(
      (b.innerText || "") + (b.getAttribute("aria-label") || ""),
    ),
  );
  if (trigger) trigger.click();
  return {
    chipInfo,
    loading,
    models,
    trigger: trigger ? (trigger.innerText || "").trim().slice(0, 80) : null,
    body: (document.body.innerText || "").replace(/\\s+/g, " ").slice(0, 700),
  };
})()`);
console.log(JSON.stringify(state, null, 2));
await new Promise((r) => setTimeout(r, 1500));

const after = await evalExpr(`(() => {
  const models = [...document.querySelectorAll("[data-model-id]")].map((el) => ({
    id: el.getAttribute("data-model-id"),
    text: (el.textContent || "").trim(),
    color: getComputedStyle(el).color,
  }));
  const menu = document.body.innerText || "";
  return {
    models,
    hasTide: /\\bTide\\b/.test(menu),
    hasFlare: /\\bFlare\\b/.test(menu),
    hasPine: /\\bPine\\b/.test(menu),
    hasOfficial: /assistix-official|ASSISTIX Official|\\bKumo\\b/i.test(menu),
    loading: /Загрузка моделей|Обновление списка/i.test(menu),
    snippet: menu.replace(/\\s+/g, " ").slice(0, 900),
  };
})()`);
console.log("AFTER OPEN", JSON.stringify(after, null, 2));
ws.close();
