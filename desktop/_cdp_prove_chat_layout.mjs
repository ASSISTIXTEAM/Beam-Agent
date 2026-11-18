import WebSocket from "ws";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((p) => p.url?.includes("beam-app")) || list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const logs = [];
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
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const a = (msg.params.args || []).map((x) => x.value ?? x.description ?? "").join(" ");
    if (/error|failed|isNullable|boot|splash/i.test(a)) logs.push(`${msg.params.type}: ${String(a).slice(0, 400)}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    logs.push("EX: " + String(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || "").slice(0, 400));
  }
});
await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");

async function ev(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
}

let snap = null;
for (let i = 0; i < 10; i++) {
  snap = await ev(`(() => {
    const splash = document.getElementById('beam-early-splash');
    const sidebar = document.querySelector('[role="tree"], [class*="sidebar"], aside');
    const scroll = document.querySelector('[data-conversation-scroll]');
    return {
      pastSplash: !splash || splash.hidden || getComputedStyle(splash).display === 'none',
      hasSidebar: !!sidebar,
      hasScroll: !!scroll,
      bodyLen: (document.body.innerText||'').length,
    };
  })()`);
  if (snap?.pastSplash && snap?.hasSidebar) break;
  await new Promise((r) => setTimeout(r, 1500));
}

await ev(`(() => {
  const items = [...document.querySelectorAll('[role="treeitem"], [class*="sessionRow"]')];
  const hit = items.find(el => /Реферат по истории|Рима/i.test(el.innerText||''))
    || items.find(el => /Greeting/.test(el.innerText||''));
  if (hit) hit.click();
  return hit ? (hit.innerText||'').slice(0,60) : null;
})()`);
await new Promise((r) => setTimeout(r, 2500));

const proof = await ev(`(() => {
  const splash = document.getElementById('beam-early-splash');
  const sidebar = document.querySelector('[role="tree"], [class*="sidebar"], aside');
  const scroll = document.querySelector('[data-conversation-scroll]');
  const msgs = document.querySelectorAll('[data-slot="conversation.chat.node"], [class*="Markdown"], [class*="xMeOpW"], [class*="messageBody"], [data-message-role]');
  const cont = document.querySelector('[data-beam-continue]');
  const btn = cont?.querySelector('button');
  const msg = cont?.querySelector('[class*="turnErrorMessage"]');
  const selected = document.querySelector('[aria-selected="true"]');
  const cssHasFix = [...document.styleSheets].some(s => {
    try { return [...s.cssRules].some(r => String(r.cssText||'').includes('data-beam-continue')); } catch { return false; }
  });
  const btnW = btn ? btn.getBoundingClientRect().width : 0;
  const btnH = btn ? btn.getBoundingClientRect().height : 0;
  const msgW = msg ? msg.getBoundingClientRect().width : 0;
  const msgH = msg ? msg.getBoundingClientRect().height : 0;
  const horizontalContinue = !cont || (btnW >= 80 && btnH < 50 && msgW >= 100 && msgH < 80);
  const tallThin = [...document.querySelectorAll('[data-conversation-scroll] *')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.width < 24 && r.height > 100 && (el.innerText||'').trim().length > 8;
  }).length;
  return {
    pastSplash: !splash || splash.hidden || getComputedStyle(splash).display === 'none',
    hasSidebar: !!sidebar,
    hasScroll: !!scroll,
    messageNodeCount: msgs.length,
    scrollTextLen: (scroll?.innerText||'').length,
    selected: (selected?.innerText||'').split('\\n')[0]?.slice(0,60) || null,
    hasContinue: !!cont,
    continueHint: (msg?.innerText||'').slice(0,80) || null,
    continueBtn: (btn?.innerText||'') || null,
    btnSize: cont ? { w: Math.round(btnW), h: Math.round(btnH) } : null,
    hintSize: cont ? { w: Math.round(msgW), h: Math.round(msgH) } : null,
    horizontalContinue,
    tallThinCount: tallThin,
    cssHasFix,
    scrollSnippet: (scroll?.innerText||'').replace(/\\s+/g,' ').slice(0,180),
  };
})()`);

const pass =
  proof?.pastSplash &&
  proof?.hasSidebar &&
  proof?.messageNodeCount > 0 &&
  proof?.scrollTextLen > 20 &&
  proof?.horizontalContinue &&
  proof?.tallThinCount === 0;

console.log(JSON.stringify({ pass, proof, bootSnap: snap, logs: logs.slice(0, 12) }, null, 2));
ws.close();
process.exit(pass ? 0 : 2);
