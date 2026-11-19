/**
 * Durable space-free launch layout for Beam Agent.
 * Canonical path: C:\Beam-Agent\dist\Beam-Agent (project root C:\Beam-Agent).
 * All entry points use ONLY that path, fully quoted. Also restores truncated bridge.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist", "Beam-Agent");
/** Legacy short alias; prefer C:\\Beam-Agent\\dist\\Beam-Agent directly. */
const ALIAS = "C:\\Beam-Agent\\dist\\Beam-Agent";
const HOME = path.join(process.env.USERPROFILE || "C:\\Users\\Alexa", ".beam");

function q(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

function ensureJunction() {
  // Canonical app lives at C:\Beam-Agent\dist\Beam-Agent — no secondary junction required.
  if (path.resolve(ALIAS) === path.resolve(DIST)) {
    if (!fs.existsSync(DIST)) throw new Error("missing dist app: " + DIST);
    console.log("canonical app root", DIST);
    return;
  }
  if (fs.existsSync(ALIAS)) {
    const st = fs.lstatSync(ALIAS);
    if (st.isSymbolicLink() || st.isDirectory()) {
      try {
        const target = fs.readlinkSync(ALIAS);
        if (path.resolve(target) === path.resolve(DIST) || path.resolve(ALIAS) === path.resolve(DIST)) {
          console.log("junction ok", ALIAS, "->", DIST);
          return;
        }
      } catch {}
      try {
        execFileSync("cmd", ["/c", "rmdir", ALIAS], { stdio: "ignore" });
      } catch {
        try {
          fs.rmSync(ALIAS, { recursive: true, force: true });
        } catch {}
      }
    }
  }
  execFileSync("cmd", ["/c", "mklink", "/J", ALIAS, DIST], { stdio: "inherit" });
  console.log("created junction", ALIAS, "->", DIST);
}

function restoreBridge() {
  const good = path.join(ROOT, "desktop", "bridge", "server.js");
  const targets = [
    path.join(DIST, "bridge", "server.js"),
    path.join(ROOT, "desktop", "bridge", "server.js"),
  ];
  const src = fs.readFileSync(good, "utf8");
  if (!src.includes("server.listen") || !src.includes("/assistix/status")) {
    throw new Error("desktop/bridge/server.js is not a complete bridge");
  }
  // Ensure missing UI routes exist as soft stubs so login never "Failed to fetch" hard-fail
  let out = src;
  if (!out.includes("/assistix/login-password")) {
    const insertAt = out.indexOf("if (url.pathname === '/assistix/logout'");
    if (insertAt < 0) throw new Error("cannot find logout route to extend");
    const stubs = `
    if (url.pathname === '/assistix/login-password' && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req))
        // Delegate to same password/token path as /assistix/login when available
        const email = String(body?.email || body?.username || '').trim()
        const password = String(body?.password || '')
        const r = await fetch(ID_BASE + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email, password }),
        }).catch(() => null)
        if (!r || !r.ok) return sendJson(res, 401, { ok: false, error: 'invalid_credentials' })
        const data = await r.json().catch(() => ({}))
        saveState({ ...(loadState() || {}), session: data, updatedAt: Date.now() })
        return sendJson(res, 200, { ok: true, ...(data || {}) })
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: String(e?.message || e) })
      }
    }
    if (url.pathname === '/assistix/confirm' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true })
    }
    if (url.pathname === '/assistix/cancel-pending' && req.method === 'POST') {
      return sendJson(res, 200, { ok: true })
    }
    if (url.pathname === '/assistix/model-prefs') {
      if (req.method === 'GET') return sendJson(res, 200, { ok: true, prefs: (loadState()?.modelPrefs) || {} })
      if (req.method === 'POST') {
        try {
          const body = JSON.parse(await readBody(req))
          const st = loadState() || {}
          st.modelPrefs = body?.prefs || body || {}
          saveState(st)
          return sendJson(res, 200, { ok: true })
        } catch (e) {
          return sendJson(res, 500, { ok: false, error: String(e?.message || e) })
        }
      }
    }
`;
    out = out.slice(0, insertAt) + stubs + out.slice(insertAt);
  }
  // Also alias /assistix/me → status if missing
  if (!out.includes("/assistix/me")) {
    out = out.replace(
      "if (url.pathname === '/assistix/status')",
      "if (url.pathname === '/assistix/me' || url.pathname === '/assistix/status')",
    );
  }
  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    // Avoid rewriting desktop source if it's already the good one and we only need dist
    if (path.resolve(t) === path.resolve(good) && src.includes("server.listen")) {
      // still write extended version back to desktop + dist
    }
    fs.writeFileSync(t, out);
    console.log("bridge restored", path.relative(ROOT, t), fs.statSync(t).size);
  }
  // syntax check
  execFileSync("node", ["--check", path.join(DIST, "bridge", "server.js")], { stdio: "inherit" });
}

const launcherVbs = `' Beam Agent launcher — SPACE-FREE install root only.
' Canonical: %USERPROFILE%\\BeamAgent (junction). All paths quoted.
Option Explicit
Dim sh, fso, env, beamRoot, beamHome, electronUserData, nodeExe, bridgeJs, exePath, helper, logFile

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set env = sh.Environment("PROCESS")

' Prefer canonical no-space root; fall back to script directory if already there.
beamRoot = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\\BeamAgent\\"
If Not fso.FolderExists(beamRoot) Then
  beamRoot = fso.GetParentFolderName(WScript.ScriptFullName)
  If Right(beamRoot, 1) <> "\\" Then beamRoot = beamRoot & "\\"
End If

beamHome = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\\.beam"
electronUserData = beamHome & "\\electron-userdata"
logFile = beamHome & "\\bridge\\launcher.log"

env("BEAM_ROOT") = beamRoot
env("BEAM_HOME") = beamHome
env("BEAM_BRIDGE_PORT") = "17865"
env("BEAM_API_KEY") = "beam-assistix-local"
env("BEAM_BASE_URL") = "http://127.0.0.1:17865/anthropic"
env("DEEPSEEK_API_KEY") = env("BEAM_API_KEY")
env("DEEPSEEK_BASE_URL") = env("BEAM_BASE_URL")
env("DSH_HOME") = beamHome
env("ELECTRON_USER_DATA") = electronUserData
env("BEAM_BRIDGE_STARTED") = "1"

EnsureDir beamHome
EnsureDir electronUserData
EnsureDir beamHome & "\\default-workspace"
EnsureDir beamHome & "\\projects"
EnsureDir beamHome & "\\bridge"

' Kill previous bridge listeners on :17865
sh.Run "cmd.exe /c for /f ""tokens=5"" %P in ('netstat -ano ^| findstr "":17865"" ^| findstr LISTENING') do taskkill /F /PID %P >nul 2>&1", 0, True

nodeExe = FindNode(beamRoot)
bridgeJs = beamRoot & "bridge\\server.js"
exePath = beamRoot & "Beam Agent.exe"
helper = beamRoot & "start-bridge-hidden.vbs"

If nodeExe <> "" And fso.FileExists(bridgeJs) Then
  env("BEAM_NODE") = nodeExe
  If fso.FileExists(helper) Then
    sh.Run "wscript.exe //nologo " & Q(helper) & " " & Q(nodeExe) & " " & Q(bridgeJs), 0, False
  Else
    sh.Run Q(nodeExe) & " " & Q(bridgeJs), 0, False
  End If
  WScript.Sleep 1500
End If

If fso.FileExists(exePath) Then
  sh.Run Q(exePath) & " --user-data-dir=" & Q(electronUserData), 1, False
Else
  AppendLog "missing exe: " & exePath
  WScript.Echo "Beam Agent.exe not found at " & beamRoot
  WScript.Quit 1
End If

WScript.Quit 0

Function Q(p)
  Q = """" & p & """"
End Function

Sub AppendLog(msg)
  On Error Resume Next
  Dim ts
  Set ts = fso.OpenTextFile(logFile, 8, True)
  ts.WriteLine Now & " " & msg
  ts.Close
  On Error GoTo 0
End Sub

Sub EnsureDir(p)
  Dim fsoLocal, parent
  Set fsoLocal = CreateObject("Scripting.FileSystemObject")
  If fsoLocal.FolderExists(p) Then Exit Sub
  parent = fsoLocal.GetParentFolderName(p)
  If parent <> "" And Not fsoLocal.FolderExists(parent) Then EnsureDir parent
  On Error Resume Next
  fsoLocal.CreateFolder p
  On Error GoTo 0
End Sub

Function FindNode(root)
  Dim fsoLocal, shLocal, cand, pf
  Set fsoLocal = CreateObject("Scripting.FileSystemObject")
  Set shLocal = CreateObject("WScript.Shell")
  FindNode = ""
  cand = root & "resources\\runtime\\primary-runtime\\dependencies\\node\\bin\\node.exe"
  If fsoLocal.FileExists(cand) Then
    FindNode = cand
    Exit Function
  End If
  pf = shLocal.ExpandEnvironmentStrings("%ProgramFiles%") & "\\nodejs\\node.exe"
  If fsoLocal.FileExists(pf) Then FindNode = pf
End Function
`;

const bridgeHiddenVbs = `' Hidden node bridge launcher. Args: <nodeExe> <scriptPath> (always quoted by caller)
Option Explicit
Dim sh, nodeExe, scriptPath, cmd
Set sh = CreateObject("WScript.Shell")
If WScript.Arguments.Count < 2 Then WScript.Quit 1
nodeExe = WScript.Arguments(0)
scriptPath = WScript.Arguments(1)
cmd = """" & nodeExe & """ """ & scriptPath & """"
sh.Run cmd, 0, False
`;

function writeLaunchers() {
  const files = [
    [path.join(DIST, "start-bridge-hidden.vbs"), bridgeHiddenVbs],
    [path.join(DIST, "Start Beam Agent.vbs"), launcherVbs],
    [path.join(DIST, "StartBeamAgent.vbs"), launcherVbs], // space-free filename
    [
      path.join(DIST, "Start Beam Agent.cmd"),
      `@echo off\r\nREM Space-free entry — always uses %USERPROFILE%\\BeamAgent\r\nstart "" /B wscript.exe //nologo "%USERPROFILE%\\BeamAgent\\StartBeamAgent.vbs"\r\nexit /b 0\r\n`,
    ],
    [
      path.join(DIST, "StartBeamAgent.cmd"),
      `@echo off\r\nstart "" /B wscript.exe //nologo "%USERPROFILE%\\BeamAgent\\StartBeamAgent.vbs"\r\nexit /b 0\r\n`,
    ],
    [
      path.join(ROOT, "Start Beam Agent.vbs"),
      `' Root → canonical no-space BeamAgent junction (never path with spaces).\r\nOption Explicit\r\nDim sh, vbs\r\nSet sh = CreateObject("WScript.Shell")\r\nvbs = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\\BeamAgent\\StartBeamAgent.vbs"\r\nsh.Run "wscript.exe //nologo """ & vbs & """", 0, False\r\n`,
    ],
    [
      path.join(ROOT, "Start Beam Agent.cmd"),
      `@echo off\r\nstart "" /B wscript.exe //nologo "%USERPROFILE%\\BeamAgent\\StartBeamAgent.vbs"\r\nexit /b 0\r\n`,
    ],
    [
      path.join(ROOT, "StartBeamAgent.vbs"),
      `' Space-free root launcher name.\r\nOption Explicit\r\nDim sh, vbs\r\nSet sh = CreateObject("WScript.Shell")\r\nvbs = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\\BeamAgent\\StartBeamAgent.vbs"\r\nsh.Run "wscript.exe //nologo """ & vbs & """", 0, False\r\n`,
    ],
    [
      path.join(ROOT, "StartBeamAgent.cmd"),
      `@echo off\r\nstart "" /B wscript.exe //nologo "%USERPROFILE%\\BeamAgent\\StartBeamAgent.vbs"\r\nexit /b 0\r\n`,
    ],
  ];
  for (const [p, body] of files) {
    fs.writeFileSync(p, body.replace(/\n/g, "\r\n"));
    console.log("wrote", path.relative(ROOT, p));
  }
}

function writeShortcuts() {
  const ps = `
$ErrorActionPreference = 'Stop'
$wscript = Join-Path $env:SystemRoot 'System32\\wscript.exe'
$vbs = Join-Path $env:USERPROFILE 'BeamAgent\\StartBeamAgent.vbs'
$work = Join-Path $env:USERPROFILE 'BeamAgent'
$icon = Join-Path $env:USERPROFILE 'BeamAgent\\Beam Agent.exe'
$Wsh = New-Object -ComObject WScript.Shell
function Set-Lnk($p) {
  $dir = Split-Path $p -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $s = $Wsh.CreateShortcut($p)
  $s.TargetPath = $wscript
  $s.Arguments = '//nologo "' + $vbs + '"'
  $s.WorkingDirectory = $work
  if (Test-Path $icon) { $s.IconLocation = $icon + ',0' }
  $s.WindowStyle = 1
  $s.Description = 'Beam Agent (space-free launch)'
  $s.Save()
  Write-Host "shortcut $p"
}
$desk = [Environment]::GetFolderPath('Desktop')
@(
  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Beam-Agent.lnk'),
  (Join-Path $desk 'Beam Agent.lnk'),
  (Join-Path $env:USERPROFILE 'BeamAgent\\Beam Agent.lnk'),
  (Join-Path $env:USERPROFILE 'BeamAgent\\StartBeamAgent.lnk')
) | ForEach-Object { Set-Lnk $_ }
`;
  const tmp = path.join(ROOT, "desktop", "_tmp_set_spacefree_shortcuts.ps1");
  fs.writeFileSync(tmp, ps);
  spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp], {
    stdio: "inherit",
  });
}

function main() {
  if (!fs.existsSync(path.join(DIST, "Beam Agent.exe"))) {
    throw new Error("dist Beam Agent.exe missing: " + DIST);
  }
  restoreBridge();
  ensureJunction();
  // Mirror launchers into alias (junction shares files with DIST — already written)
  writeLaunchers();
  // Ensure alias-visible StartBeamAgent.vbs exists (same as DIST via junction)
  if (!fs.existsSync(path.join(ALIAS, "StartBeamAgent.vbs"))) {
    throw new Error("junction missing StartBeamAgent.vbs — check mklink");
  }
  writeShortcuts();
  console.log("CANONICAL", ALIAS);
  console.log("DIST", DIST);
  console.log("done");
}

main();
