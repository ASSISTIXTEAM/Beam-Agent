import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const BEAM = "C:/Beam-Agent/dist/Beam-Agent";
const EXE = path.join(BEAM, "Beam Agent.exe");
const NODE = path.join(BEAM, "resources/runtime/primary-runtime/dependencies/node/bin/node.exe");
const BRIDGE = path.join(BEAM, "bridge/server.js");
const HOME = path.join(process.env.USERPROFILE, ".beam");
const UD = path.join(HOME, "electron-userdata");

function killBeam() {
  try { execFileSync("taskkill", ["/F", "/IM", "Beam Agent.exe"], { stdio: "ignore" }); } catch {}
  try {
    const out = execFileSync("cmd", ["/c", 'netstat -ano | findstr ":17865" | findstr LISTENING'], { encoding: "utf8" });
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/(\d+)\s*$/);
      if (m) {
        try { execFileSync("taskkill", ["/F", "/PID", m[1]], { stdio: "ignore" }); } catch {}
      }
    }
  } catch {}
}

killBeam();
await sleep(2500);

const env = {
  ...process.env,
  BEAM_ROOT: BEAM + path.sep,
  BEAM_HOME: HOME,
  DSH_HOME: HOME,
  BEAM_BRIDGE_PORT: "17865",
  BEAM_API_KEY: "beam-assistix-local",
  BEAM_BASE_URL: "http://127.0.0.1:17865/anthropic",
  DEEPSEEK_API_KEY: "beam-assistix-local",
  DEEPSEEK_BASE_URL: "http://127.0.0.1:17865/anthropic",
  ELECTRON_USER_DATA: UD,
  BEAM_BRIDGE_STARTED: "1",
};

if (fs.existsSync(NODE) && fs.existsSync(BRIDGE)) {
  spawn(NODE, [BRIDGE], { env, cwd: BEAM, detached: true, stdio: "ignore", windowsHide: true }).unref();
  await sleep(1500);
}

const child = spawn(EXE, [`--user-data-dir=${UD}`, "--remote-debugging-port=9222"], {
  env,
  cwd: BEAM,
  detached: true,
  stdio: "ignore",
  windowsHide: false,
});
child.unref();
console.log("launched", child.pid);

for (let i = 0; i < 45; i++) {
  await sleep(1000);
  try {
    const r = await fetch("http://127.0.0.1:9222/json/version");
    if (r.ok) {
      console.log("cdp ready", i + 1);
      process.exit(0);
    }
  } catch {}
}
console.error("cdp failed");
process.exit(1);
