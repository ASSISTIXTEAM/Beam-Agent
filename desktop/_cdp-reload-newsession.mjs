const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
if (!page) throw new Error("no page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
  ws.addEventListener("error", j);
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
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 3500));
const res = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    // Give injector a tick
    return new Promise((resolve) => {
      setTimeout(() => {
        const pick = document.querySelector('button.wtg9ga_newSession, button[class*="newSession"]');
        if (!pick) return resolve({ error: 'missing' });
        const label = pick.querySelector('[class*="newSessionLabel"]');
        const ls = label ? getComputedStyle(label) : null;
        const protect = !!document.getElementById('beam-fix-newsession-label') ||
          [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => String(r.cssText||'').includes('New Session label must stay text')); } catch { return false; } });
        resolve({
          text: (pick.innerText || '').replace(/\\s+/g, ' ').trim(),
          labelText: label ? (label.textContent || '').trim() : null,
          labelBeam: label ? label.getAttribute('data-beam-icon') : null,
          labelW: ls ? ls.width : null,
          labelMask: ls ? (ls.webkitMaskImage || ls.maskImage || '').slice(0, 100) : null,
          hasProtectCss: protect,
          beamStripFn: typeof beamStripNewSessionIconHosts,
          ok: !!(label && (label.textContent || '').includes('сесс') && label.getAttribute('data-beam-icon') == null && parseFloat(ls.width) > 40 && (ls.webkitMaskImage || ls.maskImage) === 'none'),
        });
      }, 800);
    });
  })()`,
  awaitPromise: true,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
