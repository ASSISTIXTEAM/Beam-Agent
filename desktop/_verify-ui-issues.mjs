const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page") || pages[0];
if (!page?.webSocketDebuggerUrl) {
  console.error("no page", pages);
  process.exit(1);
}
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
for (let i = 0; i < 25; i++) {
  const ping = await send("Runtime.evaluate", {
    expression: "document.body ? document.body.innerText.length : 0",
    returnByValue: true,
  });
  if ((ping.result?.result?.value || 0) > 40) break;
  await new Promise((r) => setTimeout(r, 1000));
}
const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const chips = [...document.querySelectorAll('button, [role=button]')].filter((el) =>
      /Beam Agent|Запись в рабочую|Workspace Write|рабоч/i.test((el.innerText || '') + (el.getAttribute('aria-label') || ''))
    );
    const chipInfo = chips.slice(0, 8).map((el) => {
      const svgs = [...el.querySelectorAll('svg')];
      return {
        text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 70),
        beamIcon: el.getAttribute('data-beam-icon'),
        svgCount: svgs.length,
        folderMasks: svgs.filter((s) => {
          const m = getComputedStyle(s).webkitMaskImage || getComputedStyle(s).maskImage || '';
          return /folder/i.test(m);
        }).length,
      };
    });
    const loadingExact = [...document.querySelectorAll('button,span,div')]
      .map((el) => (el.innerText || '').trim())
      .filter((t) => t === 'Загрузка моделей…' || t === 'Обновление списка моделей…' || t === 'Loading models…')
      .slice(0, 8);
    const modelLabels = [...document.querySelectorAll('[data-model-id]')].map((el) => ({
      id: el.getAttribute('data-model-id'),
      text: (el.textContent || '').trim().slice(0, 40),
      color: getComputedStyle(el).color,
    }));
    const body = document.body.innerText || '';
    return {
      title: document.title,
      chipInfo,
      loadingExact,
      modelLabels,
      hasTide: /\\bTide\\b/.test(body),
      hasFlare: /\\bFlare\\b/.test(body),
      hasPine: /\\bPine\\b/.test(body),
      hasOfficial: /assistix-official|ASSISTIX Official|\\bKumo\\b/i.test(body),
      snippet: body.replace(/\\s+/g, ' ').slice(0, 600),
    };
  })()`,
  returnByValue: true,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
