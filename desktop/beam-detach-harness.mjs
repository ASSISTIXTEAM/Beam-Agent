/**
 * Detach Beam Agent from DeepSeek Harness completely:
 * - fix broken @deepseek-ai package paths → @assistix
 * - remap ~/.beam workspace + session cwds off Documents/deepseek-harness
 * - scrub credentials / env aliases / Windows leftovers
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.USERPROFILE || os.homedir();
const BEAM_HOME = process.env.BEAM_HOME || path.join(HOME, ".beam");
const BEAM_WS = path.join(BEAM_HOME, "default-workspace");
const OLD_WS = path.join(HOME, "OneDrive", "Documents", "deepseek-harness", "default-workspace");
const OLD_WS_ALT = "C:\\Users\\Alexa\\OneDrive\\Documents\\deepseek-harness\\default-workspace";

const MAIN_FILES = [
  path.join(ROOT, "runtime", "app", "lib", "main.js"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "lib", "main.js"),
];

const report = [];

function patch(file, fn) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    report.push(`patched ${file}`);
    return true;
  }
  return false;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// --- 1) Fix main.js package paths + protocol + fallback dir ---
for (const main of MAIN_FILES) {
  patch(main, (s) => {
    s = s.replaceAll(
      'join(this.runtimeDir, "node_modules", "@deepseek-ai", "beam-desktop-host", "lib", "index.js")',
      'join(this.runtimeDir, "node_modules", "@assistix", "beam-desktop-host", "lib", "index.js")'
    );
    s = s.replaceAll(
      'join(resources.dsh, "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist")',
      'join(resources.dsh, "node_modules", "@assistix", "beam-web-frontend", "dist")'
    );
    s = s.replaceAll(
      'join(resources.dsh, "node_modules", "@deepseek-ai", "beam-web-frontend", "dist")',
      'join(resources.dsh, "node_modules", "@assistix", "beam-web-frontend", "dist")'
    );
    s = s.replaceAll('const LINK_PROJECTION_DIR = ".dsh-module-fallback";', 'const LINK_PROJECTION_DIR = ".beam-module-fallback";');
    s = s.replaceAll("`.dsh-module-fallback/", "`.beam-module-fallback/");
    s = s.replaceAll("<profile>/.dsh-module-fallback/", "<profile>/.beam-module-fallback/");
    // Accept both beam:// and legacy dsh:// focus URLs
    s = s.replace(
      'if (url === "dsh://open" || url === "dsh://open/") focusPrimaryWindow();',
      'if (url === "beam://open" || url === "beam://open/" || url === "dsh://open" || url === "dsh://open/") focusPrimaryWindow();'
    );
    // Prefer Assistix LLM namespace names (keep llm-deepseek as fallback match)
    s = s.replace(
      'const official = settings.namespaces.find((item) => record$3(item) && item.ns === "llm-deepseek");',
      'const official = settings.namespaces.find((item) => record$3(item) && (item.ns === "llm-assistix" || item.ns === "llm-beam" || item.ns === "llm-deepseek"));'
    );
    s = s.replaceAll("DeepSeek Harness", "Beam Agent");
    return s;
  });
}

// --- 2) Ensure Beam workspace exists; seed from old Harness ws if empty ---
ensureDir(BEAM_WS);
try {
  const beamEntries = fs.readdirSync(BEAM_WS).filter((n) => !n.startsWith("."));
  if (false && beamEntries.length === 0 && fs.existsSync(OLD_WS)) { /* beam-no-seed-harness */
    // copy non-hidden useful files only (not huge caches)
    for (const name of fs.readdirSync(OLD_WS)) {
      if (name.startsWith(".")) continue;
      const src = path.join(OLD_WS, name);
      const dest = path.join(BEAM_WS, name);
      if (fs.existsSync(dest)) continue;
      const st = fs.statSync(src);
      if (st.isFile() && st.size < 50_000_000) {
        fs.copyFileSync(src, dest);
        report.push(`copied ${name} → beam workspace`);
      } else if (st.isDirectory() && name === "assistix-chat") {
        fs.cpSync(src, dest, { recursive: true, force: false });
        report.push(`copied dir ${name} → beam workspace`);
      }
    }
  }
} catch (e) {
  report.push(`workspace seed warn: ${e.message}`);
}

// --- 3) Remap workspace.json + session caches ---
const OLD_PATHS = [
  OLD_WS_ALT,
  OLD_WS,
  OLD_WS.replaceAll("\\", "/"),
  "C:/Users/Alexa/OneDrive/Documents/deepseek-harness/default-workspace",
];

function remapDeepseekPaths(text) {
  let out = text;
  for (const old of OLD_PATHS) {
    out = out.split(old).join(BEAM_WS);
    out = out.split(old.replaceAll("\\", "\\\\")).join(BEAM_WS.replaceAll("\\", "\\\\"));
  }
  out = out.split("deepseek-harness").join("Beam Agent");
  out = out.split("DeepSeek Harness").join("Beam Agent");
  return out;
}

const workspaceJson = path.join(BEAM_HOME, "storages", "workspace.json");
if (fs.existsSync(workspaceJson)) {
  patch(workspaceJson, (s) => {
    const j = JSON.parse(s);
    const tables = j.tables?.workspaces || {};
    for (const id of Object.keys(tables)) {
      const ws = tables[id];
      if (!ws) continue;
      if (typeof ws.path === "string" && /deepseek-harness/i.test(ws.path)) {
        ws.path = BEAM_WS;
        ws.title = "Beam Agent";
        ws.updatedAt = new Date().toISOString();
      }
      if (ws.title === "default-workspace") ws.title = "Beam Agent";
    }
    return JSON.stringify(j, null, 2) + "\n";
  });
}

const sessionsDir = path.join(BEAM_HOME, "storages", "session_projcache", "sessions");
if (fs.existsSync(sessionsDir)) {
  for (const name of fs.readdirSync(sessionsDir)) {
    if (!name.endsWith(".json")) continue;
    const fp = path.join(sessionsDir, name);
    patch(fp, remapDeepseekPaths);
  }
}

// Also scrub any other json under .beam/storages that still points at harness
function walkJson(dir, depth = 0) {
  if (depth > 6 || !fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJson(fp, depth + 1);
    else if (ent.name.endsWith(".json")) {
      try {
        const s = fs.readFileSync(fp, "utf8");
        if (/deepseek-harness|DeepSeek Harness/i.test(s)) patch(fp, remapDeepseekPaths);
      } catch {}
    }
  }
}
walkJson(path.join(BEAM_HOME, "storages"));
walkJson(path.join(BEAM_HOME, "sessions"));

// --- 3b) Rename leftover session folders still named after Documents/deepseek-harness ---
const sessionsRoot = path.join(BEAM_HOME, "sessions");
const beamSessRoot = path.join(sessionsRoot, "--C-Users-Alexa-.beam-default-workspace--");
if (fs.existsSync(sessionsRoot)) {
  ensureDir(beamSessRoot);
  for (const name of fs.readdirSync(sessionsRoot)) {
    if (!/deepseek-harness/i.test(name)) continue;
    const srcRoot = path.join(sessionsRoot, name);
    try {
      for (const sid of fs.readdirSync(srcRoot)) {
        const from = path.join(srcRoot, sid);
        const to = path.join(beamSessRoot, sid);
        if (!fs.existsSync(to)) {
          fs.renameSync(from, to);
          report.push(`moved session ${sid} → beam session root`);
        }
      }
      fs.rmSync(srcRoot, { recursive: true, force: true });
      report.push(`removed harness session root ${name}`);
    } catch (e) {
      report.push(`session root migrate warn: ${e.message}`);
    }
  }
}

// Force default workspace.json onto Beam home path + title
if (fs.existsSync(workspaceJson)) {
  patch(workspaceJson, (s) => {
    const j = JSON.parse(s);
    const tables = j.tables?.workspaces || {};
    for (const id of Object.keys(tables)) {
      const ws = tables[id];
      if (!ws) continue;
      if (/deepseek-harness/i.test(String(ws.path))) {
        ws.path = BEAM_WS;
        ws.title = "Beam Agent";
        ws.updatedAt = new Date().toISOString();
      }
      if (String(ws.path).replace(/\\/g, "/") === BEAM_WS.replace(/\\/g, "/")) {
        ws.title = "Beam Agent";
      }
      if (ws.title === "default-workspace" || /DeepSeek\s*Harness/i.test(String(ws.title))) {
        ws.title = "Beam Agent";
      }
    }
    return JSON.stringify(j, null, 2) + "\n";
  });
}

// Patch workspace controller so new defaults never land under Documents/deepseek-harness
for (const ctrl of [
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-api-workspace-controller", "lib", "types", "default-directory.js"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-api-workspace-controller", "lib", "types", "default-directory.js"),
  path.join(ROOT, "runtime", "app", "beam", "node_modules", "@assistix", "beam-api-workspace-controller", "lib", "index.js"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app", "beam", "node_modules", "@assistix", "beam-api-workspace-controller", "lib", "index.js"),
]) {
  patch(ctrl, (s) => {
    if (!s.includes("deepseek-harness") && s.includes('paths.join(beamHome, DEFAULT_WORKSPACE_DIRECTORY)')) return s;
    s = s.replace(
      /return paths\.join\(directory,\s*['"]deepseek-harness['"],\s*DEFAULT_WORKSPACE_DIRECTORY\);/g,
      `const envHome = (typeof process.env.BEAM_HOME === "string" && process.env.BEAM_HOME.trim()) || (typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim()) || undefined;
	const beamHome = envHome ? paths.normalize(envHome) : paths.join(internals.home ?? homedir(), ".beam");
	if (!paths.isAbsolute(beamHome)) throw new Error(\`Beam home must be fully qualified: '\${beamHome}'\`);
	signal.throwIfAborted();
	return paths.join(beamHome, DEFAULT_WORKSPACE_DIRECTORY);`
    );
    s = s.replaceAll("<Documents>/deepseek-harness", "~/.beam");
    return s;
  });
}

// --- 4) Credentials: keep BEAM_API_KEY primary; drop DEEPSEEK_* as primary label ---
const cred = path.join(BEAM_HOME, ".credentials.yaml");
if (fs.existsSync(cred)) {
  patch(cred, (s) => {
    // Ensure BEAM_API_KEY present; map DEEPSEEK to BEAM if needed
    if (!/BEAM_API_KEY:/.test(s) && /DEEPSEEK_API_KEY:/.test(s)) {
      s = s.replace(/DEEPSEEK_API_KEY:\s*(.+)/, (m, v) => `BEAM_API_KEY: ${v}\n  DEEPSEEK_API_KEY: ${v}`);
    }
    return s;
  });
}

// API keys only in ~/.beam/.env — BEAM_BASE_URL / BEAM_HOME / DEEPSEEK_BASE_URL /
// DSH_* are launcher/bootstrap-only (Start Beam Agent.vbs PROCESS env).
const envFile = path.join(BEAM_HOME, ".env");
{
  const bannedExact = new Set([
    "BEAM_BASE_URL",
    "BEAM_HOME",
    "DEEPSEEK_BASE_URL",
    "DSH_HOME",
    "PATH",
    "HOME",
    "USERPROFILE",
    "SHELL",
    "NODE_OPTIONS",
    "NODE_PATH",
    "NODE_EXTRA_CA_CERTS",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "REQUESTS_CA_BUNDLE",
    "CURL_CA_BUNDLE",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "DEEPSEEK_SEARCH_BASE_URL",
  ]);
  const bannedPrefix = ["DSH_", "XDG_", "DYLD_", "BASH_FUNC_"];
  const map = {};
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const name = m[1];
      const upper = name.toUpperCase();
      if (bannedExact.has(upper) || bannedPrefix.some((p) => upper.startsWith(p))) continue;
      map[name] = m[2];
    }
  }
  map.BEAM_API_KEY = map.BEAM_API_KEY || "beam-assistix-local";
  map.DEEPSEEK_API_KEY = map.DEEPSEEK_API_KEY || map.BEAM_API_KEY;
  fs.mkdirSync(BEAM_HOME, { recursive: true });
  fs.writeFileSync(
    envFile,
    Object.entries(map)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
  report.push(".env kept API keys only (stripped launcher-forbidden keys)");
}

// --- 5) Rename dsh-runtimes → beam-runtimes if present ---
const dshRt = path.join(BEAM_HOME, "dsh-runtimes");
const beamRt = path.join(BEAM_HOME, "beam-runtimes");
if (fs.existsSync(dshRt) && !fs.existsSync(beamRt)) {
  try {
    fs.renameSync(dshRt, beamRt);
    report.push("renamed dsh-runtimes → beam-runtimes");
  } catch (e) {
    report.push(`rename runtimes warn: ${e.message}`);
  }
}

// --- 6) Start script: never set DSH_HOME to harness; force Beam paths ---
for (const cmd of [
  path.join(ROOT, "dist", "Beam-Agent", "Start Beam Agent.cmd"),
  path.join(ROOT, "Start Beam Agent.cmd"),
]) {
  patch(cmd, (s) => {
    s = s.replace(/DeepSeek Harness/gi, "Beam Agent");
    s = s.replace(/set "DSH_HOME=%USERPROFILE%\\.dsh"/g, 'set "BEAM_HOME=%USERPROFILE%\\.beam"');
    // Remove any pointer at Documents\\deepseek-harness
    s = s.replace(/deepseek-harness/gi, "Beam Agent");
    if (!s.includes("DEEPSEEK_API_KEY") && s.includes("BEAM_API_KEY")) {
      s = s.replace(
        'set "BEAM_BASE_URL=http://127.0.0.1:17865/anthropic"',
        'set "BEAM_BASE_URL=http://127.0.0.1:17865/anthropic"\nREM Internal provider alias (not user-facing):\nset "DEEPSEEK_API_KEY=%BEAM_API_KEY%"\nset "DEEPSEEK_BASE_URL=%BEAM_BASE_URL%"\nset "DSH_HOME=%BEAM_HOME%"'
      );
    }
    return s;
  });
}

// --- 7) Windows: MuiCache + retire legacy Programs\\DeepSeek Harness exe names ---
const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$mui = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache'
if (Test-Path $mui) {
  Get-Item $mui | Select-Object -ExpandProperty Property | ForEach-Object {
    $v = (Get-ItemProperty $mui).$_
    if ($_ -match 'Beam Agent\\.exe' -or $_ -match 'DeepSeek Harness') {
      if ($_ -match '\\.FriendlyAppName$') { Set-ItemProperty -Path $mui -Name $_ -Value 'Beam Agent' }
      if ($_ -match '\\.ApplicationCompany$') { Set-ItemProperty -Path $mui -Name $_ -Value 'ASSISTIX' }
    }
  }
}
$legacy = Join-Path $env:LOCALAPPDATA 'Programs\\DeepSeek Harness'
if (Test-Path $legacy) {
  $exe = Join-Path $legacy 'DeepSeek Harness.exe'
  if (Test-Path $exe) { Rename-Item $exe '_RETIRED_DeepSeek_Harness.exe' -Force }
  $un = Join-Path $legacy 'Uninstall DeepSeek Harness.exe'
  if (Test-Path $un) { Rename-Item $un '_RETIRED_Uninstall.exe' -Force }
}
# Start Menu: ensure Beam Agent shortcut, remove DeepSeek Harness shortcuts
$starts = @(
  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'),
  (Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs')
)
foreach ($dir in $starts) {
  Get-ChildItem $dir -Filter '*DeepSeek*' -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force
  Get-ChildItem $dir -Filter '*Harness*' -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force
}
$beamExe = 'C:\\Beam-Agent\\dist\\Beam-Agent\\Beam Agent.exe'
$lnk = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Beam-Agent.lnk'
if (Test-Path $beamExe) {
  $w = New-Object -ComObject WScript.Shell
  $s = $w.CreateShortcut($lnk)
  $s.TargetPath = Join-Path $env:SystemRoot 'System32\\wscript.exe'
  $s.Arguments = '//nologo "C:\\Beam-Agent\\dist\\Beam-Agent\\Start Beam Agent.vbs"'
  $s.WorkingDirectory = Split-Path $beamExe
  $s.WindowStyle = 7
  $s.IconLocation = $beamExe
  $s.Description = 'Beam Agent'
  $s.Save()
}
# Uninstall registry DisplayName
Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall' -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-ItemProperty $_.PsPath -ErrorAction SilentlyContinue
  if ($p.DisplayName -match 'DeepSeek|Harness') {
    Set-ItemProperty $_.PsPath -Name DisplayName -Value 'Beam Agent' -ErrorAction SilentlyContinue
    Set-ItemProperty $_.PsPath -Name Publisher -Value 'ASSISTIX' -ErrorAction SilentlyContinue
  }
}
Write-Output 'windows-scrub-ok'
`;
const psPath = path.join(ROOT, "desktop", "_tmp_windows_scrub.ps1");
fs.writeFileSync(psPath, ps);
try {
  const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`, {
    encoding: "utf8",
  });
  report.push(out.trim());
} catch (e) {
  report.push(`windows scrub warn: ${e.message}`);
}

// --- 8) Quick verify ---
for (const main of MAIN_FILES) {
  if (!fs.existsSync(main)) continue;
  const s = fs.readFileSync(main, "utf8");
  if (s.includes('@deepseek-ai", "beam-desktop-host"') || s.includes("@deepseek-ai\", \"dsh-web-frontend\"")) {
    report.push(`VERIFY FAIL still deepseek path in ${main}`);
  } else {
    report.push(`VERIFY OK paths in ${path.relative(ROOT, main)}`);
  }
}
const ws = JSON.parse(fs.readFileSync(workspaceJson, "utf8"));
const wpath = Object.values(ws.tables.workspaces)[0]?.path;
report.push(`workspace path => ${wpath}`);

console.log(JSON.stringify(report, null, 2));
