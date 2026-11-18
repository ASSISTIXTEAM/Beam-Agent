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
  // Find any script with broken pattern currently in page
  const scripts = [...document.scripts].map(s => s.src).filter(Boolean);
  return fetch(scripts.find(s => s.includes('beam-api-gateway') && s.includes('open-in-app')) || '')
    .then(r => r.text())
    .then(t => {
      const lines = t.split(/\\n/);
      const hits = [];
      lines.forEach((l,i) => { if (/\\{\\s*:\\s*\\$/.test(l) || /Unexpected/.test(l)) hits.push({i:i+1, l:l.slice(0,160)}); });
      // also try to Function-parse chunks? find first syntax issue via acorn-less: binary search
      let err = null;
      try { new Function(t); } catch(e) { err = String(e).slice(0,300); }
      return { len:t.length, hits: hits.slice(0,20), err, sampleScripts: scripts.filter(s=>s.includes('plugins')).slice(0,5) };
    });
})()`;

const r = await cdpEval(expr);
console.log(JSON.stringify(r.result?.value ?? r, null, 2));
