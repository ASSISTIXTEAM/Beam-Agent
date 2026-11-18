import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
if (!page) throw new Error("no page");
console.log("page", page.title, page.url);

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
          awaitPromise: true,
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
  const cool = document.querySelectorAll('[data-beam-cool="1"]').length;
  const tagged = document.querySelectorAll('[data-beam-icon]').length;
  const early = !!document.getElementById('beam-early-splash');
  const boot = !!document.querySelector('[data-dsh-boot],[data-beam-boot]');
  const root = document.getElementById('root');
  const buttons = [...document.querySelectorAll('button,[role=button]')].slice(0, 40).map(b => ({
    label: ((b.getAttribute('aria-label')||'') + ' ' + (b.innerText||'')).trim().slice(0,70),
    hasSvg: !!b.querySelector('svg'),
    cool: !!b.querySelector('[data-beam-cool="1"]'),
    role: b.getAttribute('data-beam-icon'),
  }));
  return {
    force: !!window.__beamCooliconsForceV5,
    cool, tagged, early, boot,
    svgCount: document.querySelectorAll('svg').length,
    rootKids: root?.children?.length || 0,
    rootText: (root?.innerText || '').slice(0, 220),
    bodyText: (document.body?.innerText||'').slice(0,180),
    buttons,
  };
})()`;

const result = await cdpEval(expr);
console.log(JSON.stringify(result.result?.value ?? result, null, 2));
