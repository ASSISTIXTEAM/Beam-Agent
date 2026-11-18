import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let WS;
try {
  WS = require("ws");
} catch {
  execSync("npm install ws --no-save", { cwd: __dirname, stdio: "inherit" });
  WS = require("ws");
}

const list = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = list.find((t) => t.type === "page") || list[0];

function cdpEval(expression) {
  return new Promise((resolve, reject) => {
    const ws = new WS(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const send = (method, params = {}) => {
      const i = ++id;
      return new Promise((res, rej) => {
        pending.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    };
    ws.on("open", async () => {
      try {
        await send("Runtime.enable");
        const r = await send("Runtime.evaluate", {
          expression,
          returnByValue: true,
          awaitPromise: false,
        });
        resolve(r);
        ws.close();
      } catch (e) {
        reject(e);
        try {
          ws.close();
        } catch {}
      }
    });
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
    ws.on("error", reject);
  });
}

const expr = `(() => {
  const boot = document.querySelector('[data-dsh-boot]');
  const cs = boot ? getComputedStyle(boot) : null;
  const mark = document.querySelector('img[src*="beam-mark"], [class*="mark"], svg use');
  // Is there a fixed overlay with beam mark?
  const overlays = [...document.querySelectorAll('body *')].filter(el => {
    const s = getComputedStyle(el);
    return (s.position === 'fixed' || s.position === 'absolute') && s.opacity !== '0' && el.getBoundingClientRect().width > 100;
  }).slice(0, 15).map(el => ({
    tag: el.tagName, id: el.id, cls: String(el.className).slice(0,80),
    display: getComputedStyle(el).display,
    visibility: getComputedStyle(el).visibility,
    hidden: el.hidden,
    text: (el.innerText||'').slice(0,40)
  }));
  return {
    bootDisplay: cs?.display,
    bootVisibility: cs?.visibility,
    bootOpacity: cs?.opacity,
    bootHiddenProp: boot?.hidden,
    bootHasHiddenAttr: boot?.hasAttribute('hidden'),
    rootChildCount: document.getElementById('root')?.childElementCount,
    overlays,
    wsReadyState: (() => { try { return [...(window.__beamSockets||[])] } catch { return null } })(),
  };
})()`;

const r = await cdpEval(expr);
console.log(JSON.stringify(r.result?.value ?? r, null, 2));

// Also try force-resolve boot ready to see if UI appears
const r2 = await cdpEval(`(() => {
  try {
    if (window.__DSH_BOOT_READY__?.resolve) {
      window.__DSH_BOOT_READY__.resolve();
      return 'resolved';
    }
    return 'no-resolve';
  } catch (e) { return String(e); }
})()`);
console.log('force resolve', r2.result?.value ?? r2);
