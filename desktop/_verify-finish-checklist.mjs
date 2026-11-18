/**
 * CDP checklist for stalled-work finish pass.
 */
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
const send = (method, params = {}, timeoutMs = 25000) =>
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
await send("Page.enable");
const evalExpr = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
  return res.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = { checks: [] };
const check = (name, ok, detail) => {
  report.checks.push({ name, ok: !!ok, detail });
  console.log(ok ? "PASS" : "FAIL", name, detail ?? "");
};

await sleep(2500);

const boot = await evalExpr(`({
  title: document.title,
  rootKids: document.getElementById('root')?.childElementCount || 0,
  bodyLen: (document.body?.innerText || '').trim().length,
  blank: (() => {
    const root = document.getElementById('root');
    return !root || root.childElementCount === 0 || ((root.innerText || '').trim().length < 8 && !root.querySelector('canvas,img,svg,input,textarea'));
  })(),
  hasSideLimits: !!document.getElementById('beam-side-limits'),
  hasFootRow: !!document.querySelector('#beam-side-limits .bsl-foot-row'),
  hasProfile: !!document.querySelector('#beam-side-limits .bsl-profile'),
  hasGear: !!document.querySelector('#beam-side-limits .bsl-gear'),
  visibleMore: [...document.querySelectorAll('button,[role=button]')].some((el) => {
    if (el.closest('#beam-side-limits,#beam-profile-modal')) return false;
    const t = (el.innerText || '').trim();
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (!/^(Ещё|More)$/i.test(t) && !/^(Ещё|More)$/i.test(aria)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(el).opacity !== '0' && getComputedStyle(el).visibility !== 'hidden';
  }),
  workspaceLeftover: /рабоч(ая|ую|ей|их)?\\s+област|\\bWorkspace\\b/i.test(document.body.innerText || ''),
  projectWording: /Проект|Project|Выбрать проект|Choose project/i.test(document.body.innerText || ''),
  snippet: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 500),
})`);
check("UI not blank", !boot.blank && boot.rootKids > 0, boot);
check("Sidebar rings+foot present", boot.hasSideLimits && boot.hasFootRow && boot.hasProfile && boot.hasGear, {
  hasSideLimits: boot.hasSideLimits,
  hasFootRow: boot.hasFootRow,
  hasProfile: boot.hasProfile,
  hasGear: boot.hasGear,
});
check("No visible «Ещё/More» above rings", !boot.visibleMore, { visibleMore: boot.visibleMore });
check("No Workspace/рабочая область leftover (or Project present)", !boot.workspaceLeftover || boot.projectWording, {
  workspaceLeftover: boot.workspaceLeftover,
  projectWording: boot.projectWording,
});

// Open model picker
const picker = await evalExpr(`(() => {
  const trigger = [...document.querySelectorAll('button')].find((b) =>
    /Tide|Flare|Pine|Выбрать модель|Select model|Загрузка моделей/i.test((b.innerText || '') + (b.getAttribute('aria-label') || ''))
  );
  if (!trigger) return { opened: false };
  trigger.click();
  return { opened: true, trigger: (trigger.innerText || '').trim().slice(0, 80) };
})()`);
await sleep(800);
const models = await evalExpr(`(() => {
  const items = [...document.querySelectorAll('[role=menuitemradio], [role=menuitem], button')].filter((el) =>
    /^(Tide|Flare|Pine)$/i.test((el.innerText || '').trim().split('\\n')[0])
  );
  const names = items.map((el) => (el.innerText || '').trim().split('\\n')[0]);
  const headers = [...document.querySelectorAll('[role=menu] *, [class*=groups] *')].map((el) => (el.childNodes[0]?.nodeValue || el.innerText || '').trim()).filter((t) => /^(Beam|ASSISTIX|assistix-official|Kumo)$/i.test(t));
  const counts = Object.fromEntries(['Tide','Flare','Pine'].map((n) => [n, names.filter((x) => x === n).length]));
  return { names, counts, headers: [...new Set(headers)].slice(0, 10), menuText: (document.body.innerText || '').includes('Tide') };
})()`);
check("Model picker opened", picker.opened, picker);
check("Tide/Flare/Pine each once", models.counts?.Tide === 1 && models.counts?.Flare === 1 && models.counts?.Pine === 1, models);
check("No Beam/provider headers", (models.headers || []).length === 0, models);

// Close menu via Escape
await evalExpr(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await sleep(300);

// Profile popup
const profile = await evalExpr(`(() => {
  const btn = document.querySelector('#beam-side-limits .bsl-profile');
  if (!btn) return { clicked: false };
  btn.click();
  return { clicked: true };
})()`);
await sleep(500);
const profileUi = await evalExpr(`({
  modal: !!document.getElementById('beam-profile-modal') && !document.getElementById('beam-profile-modal').hidden,
  title: document.getElementById('beam-profile-title')?.textContent || null,
})`);
check("Profile popup opens", profile.clicked && profileUi.modal, { profile, profileUi });
await evalExpr(`document.getElementById('beam-profile-modal')?.querySelector('[data-act=close]')?.click()`);
await sleep(300);

// Settings via gear
const settings = await evalExpr(`(() => {
  const gear = document.querySelector('#beam-side-limits .bsl-gear');
  if (!gear) return { clicked: false };
  gear.click();
  return { clicked: true };
})()`);
await sleep(1200);
const settingsUi = await evalExpr(`({
  dialog: !!document.querySelector('[role=dialog], [class*=settings], [class*=Settings]'),
  textHasSettings: /Настройки|Settings|Лимиты|Limits|Модели|Models|Общие|General/i.test(document.body.innerText || ''),
  snippet: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 400),
})`);
check("Settings opens from gear", settings.clicked && settingsUi.textHasSettings, { settings, settingsUi });

// Soft close
await evalExpr(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);

const failed = report.checks.filter((c) => !c.ok);
report.passed = report.checks.length - failed.length;
report.failed = failed.length;
console.log(JSON.stringify(report, null, 2));
ws.close();
process.exitCode = failed.length ? 1 : 0;
