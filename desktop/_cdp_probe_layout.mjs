import WebSocket from "ws";

const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
const page = list.find((p) => p.url?.includes("beam-app")) || list[0];
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
  }
});
await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");

const info = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => {
    const pick = [...document.querySelectorAll('button, [class*="Markdown"], [class*="message"], [class*="Continue"], [class*="continue"], p, span')]
      .filter(el => {
        const t = (el.innerText || '').trim();
        return /Continue|unfinished|error/i.test(t) || (t.length > 8 && el.clientWidth > 0 && el.clientWidth < 40);
      })
      .slice(0, 20)
      .map(el => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          cls: String(el.className).slice(0, 120),
          text: (el.innerText || '').slice(0, 60).replace(/\\n/g, '\\\\n'),
          w: Math.round(r.width),
          h: Math.round(r.height),
          writingMode: s.writingMode,
          direction: s.direction,
          flexDir: s.flexDirection,
          display: s.display,
          width: s.width,
          maxWidth: s.maxWidth,
          minWidth: s.minWidth,
          wordBreak: s.wordBreak,
          overflowWrap: s.overflowWrap,
          whiteSpace: s.whiteSpace,
          transform: s.transform,
        };
      });
    // also inspect chat column
    const col = document.querySelector('[class*="V4vHZW_column"], [data-slot="conversation.chat.flow"], [data-conversation-scroll]');
    const parents = [];
    let n = document.querySelector('[class*="Markdown"], [class*="xMeOpW"], [class*="messageBody"]');
    for (let i = 0; n && i < 10; i++, n = n.parentElement) {
      const s = getComputedStyle(n);
      parents.push({
        cls: String(n.className).slice(0, 100),
        w: Math.round(n.getBoundingClientRect().width),
        writingMode: s.writingMode,
        flexDir: s.flexDirection,
        display: s.display,
        maxWidth: s.maxWidth,
        width: s.width,
        wordBreak: s.wordBreak,
      });
    }
    const cssVars = {
      chatW: getComputedStyle(document.documentElement).getPropertyValue('--dsh-chat-content-width'),
      contentW: getComputedStyle(document.documentElement).getPropertyValue('--dsh-content-width'),
    };
    return { pick, parents, cssVars, colW: col ? Math.round(col.getBoundingClientRect().width) : -1 };
  })()`,
});
console.log(JSON.stringify(info.result?.result?.value ?? info, null, 2));
ws.close();
