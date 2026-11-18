import WebSocket from "ws";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((p) => p.url && p.url.includes("beam-app")) || list[0];
if (!page) throw new Error("no page");
console.log("page", page.title, page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  const i = ++id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout " + method)), 15000);
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
    console.log("CONSOLE", msg.params.type, String(a).slice(0, 600));
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails || {};
    console.log(
      "EXCEPTION",
      (d.text || "") + " " + String(d.exception?.description || "").slice(0, 1000)
    );
  }
});
await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");
await send("Log.enable");

const expr = `(() => {
  const root = document.getElementById('root');
  const scroll = document.querySelector('[data-conversation-scroll]');
  const nodes = document.querySelectorAll('[data-slot="conversation.chat.node"], [data-message-role], [class*="chatTurn"], [class*="messageBody"], [class*="Markdown"], [class*="xMeOpW"]');
  const flow = document.querySelector('[data-slot="conversation.chat.flow"]');
  const openErr = document.querySelector('[class*="openError"], [class*="V4vHZW_openError"]');
  const selected = document.querySelector('[aria-selected="true"]');
  const styles = scroll ? getComputedStyle(scroll) : null;
  const frame = document.querySelector('[class*="V4vHZW_frame"], [class*="V4vHZW_root"]');
  const frameStyle = frame ? getComputedStyle(frame) : null;
  const overlays = [...document.querySelectorAll('body *')].filter(el => {
    const s = getComputedStyle(el);
    if (s.position !== 'fixed' && s.position !== 'absolute') return false;
    const r = el.getBoundingClientRect();
    return r.width > 400 && r.height > 300 && parseFloat(s.opacity || '1') > 0.01 && s.visibility !== 'hidden' && s.display !== 'none' && (parseInt(s.zIndex || '0', 10) > 5);
  }).slice(0, 10).map(el => ({ id: el.id, cls: String(el.className).slice(0, 100), z: getComputedStyle(el).zIndex, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), bg: getComputedStyle(el).backgroundColor }));
  return {
    href: location.href,
    rootChildren: root?.childElementCount ?? -1,
    rootTextLen: (root?.innerText || '').length,
    selectedText: (selected?.innerText || '').slice(0, 120) || null,
    hasScroll: !!scroll,
    scrollDisplay: styles?.display,
    scrollVisibility: styles?.visibility,
    scrollOpacity: styles?.opacity,
    scrollHeight: scroll?.clientHeight,
    scrollWidth: scroll?.clientWidth,
    scrollChildCount: scroll?.childElementCount,
    scrollTextLen: (scroll?.innerText || '').length,
    scrollHTMLLen: (scroll?.innerHTML || '').length,
    scrollBg: styles?.backgroundColor,
    scrollColor: styles?.color,
    frameDisplay: frameStyle?.display,
    frameHeight: frame?.clientHeight,
    frameHTMLLen: (frame?.innerHTML || '').length,
    flowCount: flow?.childElementCount ?? -1,
    messageNodeCount: nodes.length,
    openErr: (openErr?.innerText || '').slice(0, 300) || null,
    bodyHasGreeting: (document.body.innerText || '').includes('Greeting'),
    bodySnippet: (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 500),
    overlays,
  };
})()`;

const ev = await send("Runtime.evaluate", {
  expression: expr,
  returnByValue: true,
  awaitPromise: true,
});
console.log("DOM", JSON.stringify(ev.result?.result?.value ?? ev.result ?? ev, null, 2));

const errExpr = `(() => {
  const hits = [];
  for (const el of document.querySelectorAll('*')) {
    const t = el.childNodes.length <= 3 ? (el.textContent || '') : '';
    if (/Minified React error|Something went wrong|TypeError|Cannot read|is not a function|forEach is not/i.test(t) && t.length < 400) {
      hits.push({ tag: el.tagName, cls: String(el.className).slice(0, 80), text: t.slice(0, 200) });
      if (hits.length >= 8) break;
    }
  }
  return { hits, splash: !!document.getElementById('beam-early-splash') && !document.getElementById('beam-early-splash')?.hidden };
})()`;
const err = await send("Runtime.evaluate", {
  expression: errExpr,
  returnByValue: true,
});
console.log("ERR", JSON.stringify(err.result?.result?.value ?? err, null, 2));

await new Promise((r) => setTimeout(r, 800));
ws.close();
process.exit(0);
