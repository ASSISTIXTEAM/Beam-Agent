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
    const t = setTimeout(() => reject(new Error("timeout " + method)), 30000);
    pending.set(mid, (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");
await send("Page.enable");
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 6500));
const ev = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return res.result?.result?.value;
};
const result = await ev(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(200);

  const visibleMore = [...document.querySelectorAll('button,[role=button]')].filter((el) => {
    if (el.closest('#beam-side-limits,#beam-profile-modal')) return false;
    const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    const aria = (el.getAttribute('aria-label') || '').trim();
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
    return /^(?:[.…⋯…]+\s*)?(?:Ещё|More|更多)$/i.test(t) || /^(?:[.…⋯…]+\s*)?(?:Ещё|More|更多)$/i.test(aria);
  }).map((el) => ({ text: (el.innerText || '').trim(), aria: el.getAttribute('aria-label'), y: Math.round(el.getBoundingClientRect().y) }));

  const trigger = [...document.querySelectorAll('button')].find((x) =>
    /Tide|Flare|Pine/i.test((x.innerText || '') + (x.getAttribute('aria-label') || ''))
  );
  trigger?.click();
  await sleep(400);
  const modelCell = [...document.querySelectorAll('[role=menuitem],button')].find((el) => /Модель|Model/i.test(el.innerText || ''));
  modelCell?.click();
  await sleep(600);
  const names = [...document.querySelectorAll('[role=menuitemradio]')].map((el) => (el.innerText || '').trim().split('\\n')[0]).filter((t) => /^(Tide|Flare|Pine)$/i.test(t));
  const headers = [...document.querySelectorAll('[role=menu] *')].map((el) => (el.childNodes[0]?.nodeValue || '').trim()).filter((t) => /^(Beam|ASSISTIX|Kumo)$/i.test(t));

  return {
    blank: (() => { const root = document.getElementById('root'); return !root || root.childElementCount === 0; })(),
    foot: {
      rings: !!document.querySelector('#beam-side-limits .bsl-rings'),
      profile: !!document.querySelector('#beam-side-limits .bsl-profile'),
      gear: !!document.querySelector('#beam-side-limits .bsl-gear'),
    },
    visibleMore,
    models: {
      names,
      counts: Object.fromEntries(['Tide','Flare','Pine'].map((n) => [n, names.filter((x) => x === n).length])),
      headers,
    },
    project: {
      hasProjectWrite: /Запись в проект|Project write/i.test(document.body.innerText || ''),
      hasWorkspace: /рабоч|\\bWorkspace\\b/i.test(document.body.innerText || ''),
      projectsLabel: (/\\bПроекты\\b/.test(document.body.innerText || '') ? 'Проекты' : (/проекты/.test(document.body.innerText || '') ? 'проекты' : (/\\bProjects\\b/.test(document.body.innerText || '') ? 'Projects' : 'none'))),
    },
  };
})()`);
console.log(JSON.stringify(result, null, 2));
const checklist = {
  "UI not blank": !result?.blank,
  "Sidebar foot profile+gear+rings": !!(result?.foot?.rings && result?.foot?.profile && result?.foot?.gear),
  "No visible Ещё/More": (result?.visibleMore || []).length === 0,
  "Models Tide/Flare/Pine x1": result?.models?.counts?.Tide === 1 && result?.models?.counts?.Flare === 1 && result?.models?.counts?.Pine === 1,
  "No provider headers": (result?.models?.headers || []).length === 0,
  "Project wording (no workspace)": !!result?.project?.hasProjectWrite && !result?.project?.hasWorkspace,
};
console.log("--- checklist ---");
for (const [k, v] of Object.entries(checklist)) console.log(v ? "PASS" : "FAIL", k);
const failed = Object.values(checklist).filter((v) => !v).length;
ws.close();
process.exitCode = failed ? 1 : 0;
