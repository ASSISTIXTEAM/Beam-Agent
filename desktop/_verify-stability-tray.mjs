import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let ok = true;
const check = (label, cond) => {
  console.log(cond ? "OK " : "FAIL ", label);
  if (!cond) ok = false;
  return cond;
};

for (const rel of [
  "runtime/app/lib/main.js",
  "dist/Beam Agent/resources/app/lib/main.js",
]) {
  const s = fs.readFileSync(path.join(ROOT, rel), "utf8");
  check(`${rel} AUMID`, s.includes('setAppUserModelId("Assistix.BeamAgent")'));
  check(`${rel} blank harden`, s.includes("beam-blank-window-harden"));
  check(`${rel} noflicker`, s.includes("beam-bootstuck-noflicker"));
  check(`${rel} tray restore`, s.includes("beam-finish-tray-restore"));
  check(`${rel} windowsHide`, s.includes("BEAM_WINDOWS_HIDE_HOST"));
  check(`${rel} tray tooltip`, s.includes('setToolTip("Beam Agent")'));
  check(`${rel} tray polish`, s.includes("BEAM_STABILITY_TRAY"));
  check(`${rel} no DSH shell break marker`, !s.includes("beam-no-flicker-remount"));
}

for (const rel of [
  "runtime/app/lib/preload-app.cjs",
  "dist/Beam Agent/resources/app/lib/preload-app.cjs",
]) {
  const s = fs.readFileSync(path.join(ROOT, rel), "utf8");
  check(`${rel} Приложение`, s.includes('application: "Приложение"'));
  check(`${rel} Правка`, s.includes('edit: "Правка"'));
  check(`${rel} ru-first`, s.includes("BEAM_STABILITY_TRAY: ru-first"));
}

check("tray.ico size", fs.statSync(path.join(ROOT, "dist/Beam Agent/resources/tray.ico")).size > 4096);
check("runtime tray-windows.ico", fs.existsSync(path.join(ROOT, "runtime/app/resources/tray-windows.ico")));

const envPath = path.join(os.homedir(), ".beam", ".env");
if (fs.existsSync(envPath)) {
  check("no BEAM_BASE_URL in .env", !/^\s*BEAM_BASE_URL\s*=/m.test(fs.readFileSync(envPath, "utf8")));
} else {
  check("no ~/.beam/.env", true);
}

process.exit(ok ? 0 : 1);
