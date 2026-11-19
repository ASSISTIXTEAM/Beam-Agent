import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import WebSocket from "ws";

const ROOT = "C:/Beam-Agent";
const DIST = path.join(ROOT, "dist", "Beam-Agent");
const HOME = path.join(process.env.USERPROFILE, ".beam");
const EXE = path.join(DIST, "Beam Agent.exe");
const NODE = path.join(DIST, "resources/runtime/primary-runtime/dependencies/node/bin/node.exe");
const BRIDGE = path.join(DIST, "bridge/server.js");
const LOG = path.join(ROOT, "_boot-verify.log");

function killBeam() {
  try {
    execFileSync("taskkill", ["/F", "/IM", "Beam Agent.exe"], { stdio: "ignore" });
  } catch {}
  try {
    const out = execFileSync("cmd", ["/c", 'netstat -ano | findstr ":17865" | findstr LISTENING'], {
      encoding: "utf8",
    });
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/(\d+)\s*$/);
      if (m) {
        try {
          execFileSync("taskkill", ["/F", "/PID", m[1]], { stdio: "ignore" });
        } catch {}
      }
    }
  } catch {}
}

killBeam();
await sleep(2000);

fs.writeFileSync(LOG, "");
const env = {
  ...process.env,
  BEAM_ROOT: DIST + path.sep,
  BEAM_HOME: HOME,
  DSH_HOME: HOME,
  BEAM_BRIDGE_PORT: "17865",
  BEAM_API_KEY: "beam-assistix-local",
  BEAM_BASE_URL: "http://127.0.0.1:17865/anthropic",
  DEEPSEEK_API_KEY: "beam-assistix-local",
  DEEPSEEK_BASE_URL: "http://127.0.0.1:17865/anthropic",
  ELECTRON_USER_DATA: path.join(HOME, "electron-userdata"),
  BEAM_BRIDGE_STARTED: "1",
};

if (fs.existsSync(NODE) && fs.existsSync(BRIDGE)) {
  spawn(NODE, [BRIDGE], {
    env,
    cwd: DIST,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
  await sleep(1500);
}

const child = spawn(
  EXE,
  [`--user-data-dir=${path.join(HOME, "electron-userdata")}`, "--remote-debugging-port=9222"],
  {
    env,
    cwd: DIST,
    detached: true,
    stdio: ["ignore", "ignore", fs.openSync(LOG, "a")],
    windowsHide: false,
  },
);
child.unref();
console.log("launched pid", child.pid);

let pages = [];
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  try {
    pages = await (await fetch("http://127.0.0.1:9222/json/list")).json();
    if (pages.some((p) => (p.url || "").includes("beam-app://app"))) break;
  } catch {}
}
console.log(
  "pages",
  pages.map((p) => `${p.type} ${p.title} ${p.url}`).join(" | ") || "(none)",
);

const page =
  pages.find((p) => (p.url || "").includes("beam-app://app")) ||
  pages.find((p) => p.type === "page") ||
  pages[0];
if (!page?.webSocketDebuggerUrl) {
  console.log("NO_CDP");
  console.log("LOG_TAIL", fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").slice(-2000) : "");
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const logs = [];
function send(method, params = {}) {
  const i = ++id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout " + method)), 25000);
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
    const a = (msg.params.args || []).map((x) => x.value ?? x.description ?? "").join(" ");
    logs.push(`${msg.params.type}: ${String(a).slice(0, 500)}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails || {};
    logs.push(`EXCEPTION: ${(d.text || "")} ${String(d.exception?.description || "").slice(0, 800)}`);
  }
});
await new Promise((r) => ws.on("open", r));
await send("Runtime.enable");
await send("Log.enable");

async function evalExpr(expression) {
  const ev = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (ev.result?.exceptionDetails) return { __err: ev.result.exceptionDetails };
  return ev.result?.result?.value;
}

const snapExpr = `(() => {
  const splash = document.getElementById('beam-early-splash');
  const root = document.getElementById('root');
  const boot = document.querySelector('[data-dsh-boot]:not([hidden]), [data-beam-boot]:not([hidden])');
  const sidebar = document.querySelector('[class*="sidebar" i], [class*="Sidebar"], aside, [role="tree"]');
  const hasUi = !!(sidebar || root?.querySelector('textarea, [contenteditable="true"], [role="textbox"], #beam-auth-gate, #beam-side-limits'));
  return {
    href: location.href,
    splashPresent: !!splash,
    splashHidden: !splash || splash.hidden || splash.hasAttribute('hidden'),
    bootPresent: !!boot,
    rootChildren: root?.childElementCount ?? -1,
    rootTextLen: (root?.innerText || '').trim().length,
    hasSidebar: !!sidebar,
    hasUi,
    body: (document.body?.innerText || '').replace(/\\s+/g,' ').slice(0, 180),
    capFired: !!window.__beamBootCapFired,
    hasDesktopBoot: typeof globalThis.dshDesktopBoot !== 'undefined',
    hasBootReady: typeof globalThis.__DSH_BOOT_READY__ !== 'undefined',
  };
})()`;

let final = null;
for (let i = 0; i < 25; i++) {
  final = await evalExpr(snapExpr);
  console.log("SNAP" + i, JSON.stringify(final));
  if (final && final.hasUi && final.splashHidden && !final.bootPresent) break;
  if (final && final.hasSidebar) break;
  await sleep(2000);
}

// host process?
try {
  const procs = execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process -Filter \"Name='Beam Agent.exe'\" | Select-Object -ExpandProperty CommandLine",
  ], { encoding: "utf8" });
  console.log("PROCS\n" + procs);
  console.log("HOST?", /beam-desktop-host|expose-internals/.test(procs));
} catch (e) {
  console.log("proc err", e.message);
}

console.log("FINAL", JSON.stringify(final, null, 2));
console.log("LOGS", logs.slice(-30).join("\n"));
console.log("STDERR", fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").slice(-2500) : "");
ws.close();
const ok = !!(final && (final.hasUi || final.hasSidebar) && (final.splashHidden || !final.splashPresent));
process.exit(ok ? 0 : 3);
