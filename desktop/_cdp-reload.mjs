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
      await send("Page.enable");
      await send("Page.reload", { ignoreCache: true });
      setTimeout(async () => {
        const r = await send("Runtime.evaluate", {
          expression: `({
            v6: !!window.__beamCooliconsForceV6,
            cool: document.querySelectorAll('[data-beam-cool="1"]').length,
            tagged: document.querySelectorAll('[data-beam-icon]').length,
            boot: !!document.querySelector('[data-dsh-boot]:not([hidden])'),
          })`,
          returnByValue: true,
        });
        console.log(JSON.stringify(r.result?.value, null, 2));
        ws.close();
        resolve();
      }, 8000);
    } catch (e) {
      reject(e);
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
