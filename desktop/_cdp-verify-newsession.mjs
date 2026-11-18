const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
if (!page) throw new Error("no page");
console.log("page", page.title, page.url);

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
function send(method, params = {}, timeoutMs = 15000) {
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

// Live strip + inject protect CSS so we can verify without full asset remount
await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    for (const el of document.querySelectorAll('[class*="newSessionLabel"], [class*="newSessionContent"], [class*="newSessionLabelMask"], [class*="newSessionShortcut"]')) {
      el.removeAttribute('data-beam-icon');
      el.removeAttribute('data-beam-icon-state');
    }
    let s = document.getElementById('beam-fix-newsession-label');
    if (!s) {
      s = document.createElement('style');
      s.id = 'beam-fix-newsession-label';
      s.textContent = \`
[class*="newSessionLabel"],
[class*="newSessionContent"],
[class*="newSessionLabelMask"],
[class*="newSessionShortcut"] {
  -webkit-mask: none !important;
  mask: none !important;
  background: transparent !important;
  background-color: transparent !important;
  min-width: 0 !important;
  min-height: 0 !important;
  font-size: inherit !important;
  color: inherit !important;
  opacity: 1 !important;
}
[class*="newSessionLabelMask"] { flex: 1 !important; width: auto !important; height: auto !important; }
[class*="newSessionContent"] {
  display: flex !important;
  width: 100cqw !important;
  height: auto !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
}
[class*="newSessionLabel"] {
  display: inline !important;
  width: auto !important;
  height: auto !important;
  max-width: 200px !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}
\`;
      document.documentElement.appendChild(s);
    }
    return true;
  })()`,
});

await new Promise((r) => setTimeout(r, 200));

const res = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const pick = document.querySelector('button.wtg9ga_newSession, button[class*="newSession"]');
    if (!pick) return { error: 'missing' };
    const label = pick.querySelector('[class*="newSessionLabel"]');
    const content = pick.querySelector('[class*="newSessionContent"]');
    const ls = label ? getComputedStyle(label) : null;
    const cs = content ? getComputedStyle(content) : null;
    return {
      aria: pick.getAttribute('aria-label'),
      beamBtn: pick.getAttribute('data-beam-icon'),
      text: (pick.innerText || '').replace(/\\s+/g, ' ').trim(),
      labelText: label ? (label.textContent || '').trim() : null,
      labelBeam: label ? label.getAttribute('data-beam-icon') : null,
      labelW: ls ? ls.width : null,
      labelH: ls ? ls.height : null,
      labelMask: ls ? (ls.webkitMaskImage || ls.maskImage || '').slice(0, 80) : null,
      contentW: cs ? cs.width : null,
      contentMask: cs ? (cs.webkitMaskImage || cs.maskImage || '').slice(0, 80) : null,
      ok: !!(label && (label.textContent || '').includes('сесс') && parseFloat(ls.width) > 40 && (ls.webkitMaskImage || ls.maskImage) === 'none'),
    };
  })()`,
});
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2));
ws.close();
