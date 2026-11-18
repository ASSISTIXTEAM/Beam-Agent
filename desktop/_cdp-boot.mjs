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

function cdp(methods) {
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
        const out = [];
        for (const [method, params] of methods) {
          out.push([method, await send(method, params)]);
        }
        resolve(out);
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
  const msgs = [];
  // collect recent console if we hooked; just probe state
  const bootEl = document.querySelector('[data-dsh-boot],[data-beam-boot]');
  const rootHtml = document.getElementById('root')?.innerHTML?.slice(0, 500) || '';
  const ready = window.__DSH_BOOT_READY__;
  let readyState = null;
  try {
    readyState = ready ? { has: true, keys: Object.keys(ready||{}) } : { has: false };
  } catch (e) { readyState = String(e); }
  return {
    href: location.href,
    readyState,
    bootAttr: bootEl ? [...bootEl.attributes].map(a=>a.name+'='+a.value).slice(0,12) : null,
    rootHtml,
    scripts: [...document.scripts].map(s => s.id || s.src || 'inline').slice(0, 20),
    forceV5: !!window.__beamCooliconsForceV5,
    errors: (window.__beamBootErrors || []),
  };
})()`;

const out = await cdp([
  ["Runtime.enable", {}],
  ["Console.enable", {}],
  ["Runtime.evaluate", { expression: expr, returnByValue: true }],
  [
    "Runtime.evaluate",
    {
      expression: `(() => {
        const logs = [];
        // try inspect failed modules
        return {
          performanceEntries: performance.getEntriesByType('resource').slice(0,30).map(e => ({name:e.name, duration:e.duration, transferSize:e.transferSize})),
        };
      })()`,
      returnByValue: true,
    },
  ],
]);

for (const [method, result] of out) {
  if (method === "Runtime.evaluate") {
    console.log(JSON.stringify(result.result?.value ?? result, null, 2));
  }
}
