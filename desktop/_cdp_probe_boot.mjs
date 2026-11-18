import WebSocket from "ws";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((p) => p.url?.includes("beam-app")) || list[0];
if (!page) throw new Error("no page");
console.log("page", page.title, page.url);

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
    const a = (msg.params.args || [])
      .map((x) => x.value ?? x.description ?? "")
      .join(" ");
    const line = `${msg.params.type}: ${String(a).slice(0, 800)}`;
    logs.push(line);
    console.log("CONSOLE", line);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails || {};
    const line = `EXCEPTION: ${(d.text || "")} ${String(d.exception?.description || "").slice(0, 1200)}`;
    logs.push(line);
    console.log(line);
  }
});
await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");
await send("Log.enable");

async function evalExpr(expression) {
  const ev = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (ev.result?.exceptionDetails) {
    return { __err: ev.result.exceptionDetails.text || "eval err", detail: ev.result.exceptionDetails };
  }
  return ev.result?.result?.value;
}

const snapExpr = `(() => {
  const splash = document.getElementById('beam-early-splash');
  const root = document.getElementById('root');
  const sidebar = document.querySelector('[class*="sidebar"], [class*="Sidebar"], aside, [role="tree"]');
  const scroll = document.querySelector('[data-conversation-scroll]');
  const msgs = document.querySelectorAll('[data-slot="conversation.chat.node"], [data-message-role], [class*="messageBody"], [class*="Markdown"], [class*="xMeOpW"], [class*="chatTurn"]');
  const selected = document.querySelector('[aria-selected="true"]');
  const boot = document.querySelector('[data-dsh-boot], [data-beam-boot]');
  return {
    splashHidden: !splash || splash.hidden || splash.getAttribute('hidden') !== null && splash.hasAttribute('hidden'),
    splashPresent: !!splash,
    splashDisplay: splash ? getComputedStyle(splash).display : null,
    rootTextLen: (root?.innerText || '').length,
    rootHTMLLen: (root?.innerHTML || '').length,
    rootChildren: root?.childElementCount ?? -1,
    hasSidebar: !!sidebar,
    hasScroll: !!scroll,
    scrollTextLen: (scroll?.innerText || '').length,
    messageNodeCount: msgs.length,
    selected: (selected?.innerText || '').slice(0, 80) || null,
    bootPresent: !!boot,
    bodySnippet: (document.body.innerText || '').replace(/\\s+/g,' ').slice(0, 400),
    greeting: (document.body.innerText || '').includes('Greeting'),
  };
})()`;

for (let i = 0; i < 8; i++) {
  const snap = await evalExpr(snapExpr);
  console.log("SNAP" + i, JSON.stringify(snap));
  if (snap && snap.hasSidebar && !snap.splashPresent && snap.messageNodeCount > 0) break;
  if (snap && snap.hasSidebar && snap.splashHidden && snap.rootTextLen > 50) break;
  await new Promise((r) => setTimeout(r, 2000));
}

// Click Greeting session if visible
await evalExpr(`(() => {
  const nodes = [...document.querySelectorAll('[role="treeitem"], [class*="sessionRow"], button, div')];
  const hit = nodes.find(el => /\\bGreeting\\b/.test((el.innerText||'').split('\\n')[0]||''));
  if (hit) { hit.click(); return (hit.innerText||'').slice(0,60); }
  return null;
})()`);
await new Promise((r) => setTimeout(r, 2500));
const final = await evalExpr(snapExpr);
console.log("FINAL", JSON.stringify(final, null, 2));
console.log("LOGS", logs.length);
ws.close();
process.exit(0);
