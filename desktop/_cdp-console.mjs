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

const messages = [];
await new Promise((resolve, reject) => {
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
      await send("Log.enable");
      await send("Console.enable");
      await send("Network.enable");
      // listen a bit
      setTimeout(async () => {
        const r = await send("Runtime.evaluate", {
          expression: `(() => ({
            href: location.href,
            rootHTML: document.getElementById('root')?.outerHTML?.slice(0,800) || 'NOROOT',
            bodyKids: [...document.body.children].map(e => e.id || e.tagName + '.' + String(e.className).slice(0,40)).slice(0,30),
            hasClient: !!document.querySelector('script[src*=\"beam-client-modules\"]'),
            ready: !!(window.__DSH_BOOT_READY__),
          }))()`,
          returnByValue: true,
        });
        console.log("STATE", JSON.stringify(r.result?.value, null, 2));
        console.log("CONSOLE_MSGS", JSON.stringify(messages.slice(-40), null, 2));
        ws.close();
        resolve();
      }, 3000);
    } catch (e) {
      reject(e);
    }
  });
  ws.on("message", (data) => {
    const msg = JSON.parse(String(data));
    if (msg.method === "Runtime.consoleAPICalled") {
      messages.push({
        type: msg.params.type,
        args: (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type),
      });
    }
    if (msg.method === "Log.entryAdded") {
      messages.push({ log: msg.params.entry });
    }
    if (msg.method === "Runtime.exceptionThrown") {
      messages.push({
        exception: msg.params.exceptionDetails?.text || msg.params.exceptionDetails?.exception?.description,
      });
    }
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    }
  });
  ws.on("error", reject);
});
