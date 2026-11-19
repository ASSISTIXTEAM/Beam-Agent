import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import fs from "node:fs";

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
        resolve(
          await send("Runtime.evaluate", {
            expression,
            returnByValue: true,
            awaitPromise: true,
          })
        );
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

const expr = `(async () => {
  const url = "beam-app://app/plugins/??@assistix/beam-client-ui-sidebar-documentpreview/client.js";
  const t = await (await fetch(url)).text();
  const lines = t.split(/\\n/);
  const bad = [];
  lines.forEach((l,i) => { if (/\\{\\s*:/.test(l) || /register\\([^\\n]*\\{\\s*:/.test(l)) bad.push([i+1,l.slice(0,200)]); });
  let err=null; try{ new Function(t);}catch(e){err=String(e);}
  return {
    len:t.length,
    err,
    around6190: lines.slice(6185,6198),
    bad: bad.slice(0,20),
  };
})()`;

const r = await cdpEval(expr);
const v = r.result?.value;
console.log(JSON.stringify(v, null, 2));
fs.writeFileSync(path.join(__dirname, "_docpreview-around.txt"), (v?.around6190||[]).map((l,i)=>`${6186+i}|${l}`).join("\n"));

// also check disk file around same area
const disk = "C:/Beam-Agent/dist/Beam-Agent/resources/app/beam/node_modules/@assistix/beam-client-ui-sidebar-documentpreview/lib/client.js";
const dlines = fs.readFileSync(disk,"utf8").split(/\\n/);
console.log("DISK around 6188:");
for (let i=6185;i<6198;i++) console.log((i+1)+"|"+(dlines[i]||"").slice(0,200));
