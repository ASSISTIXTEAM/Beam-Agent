import WebSocket from "ws";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((p) => p.url?.includes("beam-app")) || list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  const i = ++id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout " + method)), 20000);
    pending.set(i, {
      resolve: (v) => {
        clearTimeout(t);
        resolve(v);
      },
      reject,
    });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
ws.on("message", (buf) => {
  const msg = JSON.parse(buf.toString());
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id).resolve(msg);
    pending.delete(msg.id);
  }
});
await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");

async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value ?? r.result;
}

const clicked = await ev(`(() => {
  const items = [...document.querySelectorAll('[role="treeitem"], [class*="sessionRow"]')];
  const hit = items.find(el => /Реферат по истории|Drevn|Рима/i.test(el.innerText||''))
    || items.find(el => /Greeting/.test(el.innerText||''));
  if (!hit) return { ok:false, n: items.length };
  hit.click();
  return { ok:true, text:(hit.innerText||'').slice(0,80) };
})()`);
console.log("click", clicked);
await new Promise((r) => setTimeout(r, 2500));

const dump = await ev(`(() => {
  const cont = document.querySelector('[data-beam-continue]');
  const btns = [...document.querySelectorAll('button')].filter(b => /Continue|Продолжить/i.test(b.innerText||''));
  const hints = [...document.querySelectorAll('*')].filter(el => /unfinished|оборвал|看起来|未完成|reply looks/i.test(el.innerText||'') && (el.innerText||'').length < 80).slice(0,8);
  function style(el) {
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      cls: String(el.className).slice(0,140),
      text: (el.innerText||'').slice(0,80).replace(/\\n/g,'|'),
      w: Math.round(r.width), h: Math.round(r.height),
      display: s.display, flexDir: s.flexDirection, writingMode: s.writingMode,
      width: s.width, maxWidth: s.maxWidth, minWidth: s.minWidth,
      wordBreak: s.wordBreak, whiteSpace: s.whiteSpace, overflowWrap: s.overflowWrap,
      alignItems: s.alignItems, justifyContent: s.justifyContent,
      flex: s.flex, flexBasis: s.flexBasis, boxSizing: s.boxSizing,
      padding: s.padding, gap: s.gap,
    };
  }
  const chain = [];
  let n = cont || btns[0] || hints[0];
  for (let i=0; n && i<12; i++, n=n.parentElement) chain.push(style(n));

  // Find any element with tiny width but tall height (vertical stack signature)
  const tallThin = [...document.querySelectorAll('[data-conversation-scroll] *')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.width < 30 && r.height > 80 && (el.innerText||'').trim().length > 5;
    })
    .slice(0, 15)
    .map(style);

  // Check matched CSS rules on continue button
  let rules = [];
  const target = cont?.querySelector('button') || btns[0] || cont;
  if (target && target.ownerDocument?.defaultView?.getMatchedCSSRules) {
    // deprecated
  }
  if (target) {
    try {
      const sheets = [...document.styleSheets];
      for (const sheet of sheets) {
        let cssRules;
        try { cssRules = [...sheet.cssRules]; } catch { continue; }
        for (const rule of cssRules) {
          if (!rule.selectorText) continue;
          try {
            if (target.matches(rule.selectorText) || (cont && cont.matches(rule.selectorText))) {
              const t = rule.cssText;
              if (/width|flex|writing|word-break|max-width|min-width|direction|column/i.test(t)) {
                rules.push(t.slice(0, 260));
              }
            }
          } catch {}
        }
      }
    } catch (e) { rules = [String(e)]; }
  }

  return {
    hasContinue: !!cont,
    btnCount: btns.length,
    cont: style(cont),
    btn: style(btns[0] || cont?.querySelector('button')),
    hint: style(hints[0]),
    chain,
    tallThin,
    rules: rules.slice(0, 40),
    scrollText: (document.querySelector('[data-conversation-scroll]')?.innerText||'').slice(0, 300),
  };
})()`);
console.log(JSON.stringify(dump, null, 2));
ws.close();
