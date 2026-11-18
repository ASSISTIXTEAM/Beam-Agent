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
const ev = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return res.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.reload", { ignoreCache: true });
await sleep(6000);

const result = await ev(`(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 3; i++) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(120);
  }
  const trigger = [...document.querySelectorAll('button')].find((x) =>
    /Tide|Flare|Pine/i.test((x.innerText || '') + (x.getAttribute('aria-label') || ''))
  );
  if (!trigger) return { err: 'no trigger' };
  trigger.click();
  await sleep(500);
  const modelCell = [...document.querySelectorAll('[role=menuitem],button')].find((el) =>
    /Модель|Model/i.test(el.innerText || '')
  );
  if (!modelCell) {
    return {
      err: 'no model cell',
      openMenu: [...document.querySelectorAll('[role=menu]')].map((m) => m.innerText).join(' | '),
    };
  }
  modelCell.click();
  await sleep(700);
  const radios = [...document.querySelectorAll('[role=menuitemradio]')].map((el) =>
    (el.innerText || '').trim().split('\\n')[0]
  );
  const names = radios.filter((t) => /^(Tide|Flare|Pine)$/i.test(t));
  const headers = [...document.querySelectorAll('[role=menu] *')]
    .flatMap((el) => [el.childNodes[0]?.nodeValue, el.getAttribute?.('aria-label')])
    .map((t) => String(t || '').trim())
    .filter((t) => /^(Beam|ASSISTIX|Kumo|assistix-official)$/i.test(t));
  // Also hide check for visible More
  const visibleMore = [...document.querySelectorAll('button,[role=button]')].some((el) => {
    if (el.closest('#beam-side-limits,#beam-profile-modal')) return false;
    const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (getComputedStyle(el).opacity === '0' || getComputedStyle(el).visibility === 'hidden') return false;
    return /Ещё|More/i.test(t);
  });
  return {
    names,
    counts: Object.fromEntries(['Tide', 'Flare', 'Pine'].map((n) => [n, names.filter((x) => x === n).length])),
    headers: [...new Set(headers)],
    menuText: [...document.querySelectorAll('[role=menu]')].map((m) => m.innerText).join('\\n---\\n').slice(0, 900),
    visibleMore,
    sectionProjects: /\\bProjects\\b|\\bПроекты\\b|проекты/.test(document.body.innerText || ''),
    bodyHasWorkspace: /рабоч|\\bWorkspace\\b/i.test(document.body.innerText || ''),
  };
})()`);

console.log(JSON.stringify(result, null, 2));
const ok =
  result?.counts?.Tide === 1 &&
  result?.counts?.Flare === 1 &&
  result?.counts?.Pine === 1 &&
  (result?.headers || []).length === 0 &&
  !result?.visibleMore;
console.log(ok ? "PASS" : "FAIL");
ws.close();
process.exitCode = ok ? 0 : 1;
