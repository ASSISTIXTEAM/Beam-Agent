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
        for (const [method, params] of methods) out.push(await send(method, params));
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

const url =
  "beam-app://app/plugins/??@assistix/beam-client-ui-sidebar-documentpreview/client.js&rev=536013fc6cc7";

const [,, get] = await cdp([
  ["Network.enable", {}],
  ["Page.enable", {}],
  [
    "Runtime.evaluate",
    {
      expression: `fetch(${JSON.stringify(url)}).then(r=>r.text()).then(t=>({len:t.length, line1725:t.split(/\\n/)[1724]?.slice(0,300), around:t.split(/\\n/).slice(1718,1732)}))`,
      returnByValue: true,
      awaitPromise: true,
    },
  ],
]);

const v = get.result?.value;
console.log(JSON.stringify(v, null, 2));
if (v?.around) {
  fs.writeFileSync(
    path.join(__dirname, "_bad-docpreview-snippet.txt"),
    v.around.map((l, i) => `${1719 + i}|${l}`).join("\n")
  );
}
