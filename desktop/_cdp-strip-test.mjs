const pages = await (await fetch("http://127.0.0.1:9229/json")).json();
const page = pages.find((p) => p.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => {
  ws.addEventListener("open", r);
  ws.addEventListener("error", j);
});
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(String(ev.data));
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await send("Runtime.enable");

const evalExpr = async (expression) => {
  const res = await send("Runtime.evaluate", { expression, returnByValue: true });
  return res.result?.result?.value ?? res;
};

const before = await evalExpr(`(() => {
  const pick = document.querySelector('[class*="newSession"]');
  const nested = [...(pick?.querySelectorAll('[data-beam-icon]') || [])].map((el) => ({
    cls: String(el.className).slice(0, 80),
    beam: el.getAttribute('data-beam-icon'),
    tag: el.tagName,
  }));
  return {
    btn: pick?.getAttribute('data-beam-icon'),
    nested,
    stripFn: typeof window.beamStripNewSessionIconHosts,
  };
})()`);
console.log("BEFORE", JSON.stringify(before, null, 2));

const after = await evalExpr(`(() => {
  for (const el of document.querySelectorAll('[class*="newSessionLabel"], [class*="newSessionContent"], [class*="newSessionLabelMask"], [class*="newSessionShortcut"]')) {
    el.removeAttribute('data-beam-icon');
    el.removeAttribute('data-beam-icon-state');
    el.style.setProperty('-webkit-mask', 'none', 'important');
    el.style.setProperty('mask', 'none', 'important');
    el.style.setProperty('background', 'transparent', 'important');
    el.style.setProperty('width', 'auto', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('min-width', '0', 'important');
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('font-size', '14px', 'important');
    el.style.setProperty('color', 'inherit', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('max-width', '200px', 'important');
  }
  // also neutralize bad rule on button children that aren't svg
  const pick = document.querySelector('button[class*="newSession"], [class*="newSession"]');
  const label = pick?.querySelector('[class*="newSessionLabel"]');
  const cs = label ? getComputedStyle(label) : null;
  return {
    labelBeam: label?.getAttribute('data-beam-icon'),
    text: label?.textContent,
    width: cs?.width,
    mask: (cs?.webkitMaskImage || cs?.maskImage || '').slice(0, 80),
    bg: cs?.backgroundColor,
    fontSize: cs?.fontSize,
    color: cs?.color,
  };
})()`);
console.log("AFTER FORCE", JSON.stringify(after, null, 2));

await new Promise((r) => setTimeout(r, 1500));
const later = await evalExpr(`(() => {
  const pick = document.querySelector('button[class*="newSession"], [class*="newSession"]');
  const label = pick?.querySelector('[class*="newSessionLabel"]');
  const nested = [...(pick?.querySelectorAll('[data-beam-icon]') || [])].map((el) => ({
    cls: String(el.className).slice(0, 60),
    beam: el.getAttribute('data-beam-icon'),
  }));
  const cs = label ? getComputedStyle(label) : null;
  return {
    btn: pick?.getAttribute('data-beam-icon'),
    labelBeam: label?.getAttribute('data-beam-icon'),
    nested,
    width: cs?.width,
    mask: (cs?.webkitMaskImage || cs?.maskImage || '').slice(0, 80),
  };
})()`);
console.log("1.5s LATER", JSON.stringify(later, null, 2));
ws.close();
