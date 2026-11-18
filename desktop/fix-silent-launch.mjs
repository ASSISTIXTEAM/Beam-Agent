/**
 * Permanent silent launch: no cmd/powershell console flash on Beam Agent start.
 * - Electron desktop-host spawn → windowsHide:true (CREATE_NO_WINDOW)
 * - Launchers → VBS-only (hidden); .cmd only delegates to VBS
 * - Shortcuts → wscript.exe + Start Beam Agent.vbs (never .cmd / .exe)
 * Does NOT write BEAM_BASE_URL into ~/.beam/.env (PROCESS env / Electron only).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist", "Beam Agent");

const MAIN_FILES = [
  path.join(ROOT, "runtime", "app", "lib", "main.js"),
  path.join(DIST, "resources", "app", "lib", "main.js"),
];

const report = [];

function patchMainWindowsHide(file) {
  if (!fs.existsSync(file)) {
    report.push(`skip missing ${path.relative(ROOT, file)}`);
    return;
  }
  let s = fs.readFileSync(file, "utf8");
  const before = s;

  // Desktop host node child — this is the black console when launching .exe / tray / taskbar.
  if (!s.includes("/* BEAM_WINDOWS_HIDE_HOST */")) {
    const needle = `stdio: [
				"ignore",
				"pipe",
				"pipe",
				"ipc"
			]
		});`;
    const repl = `stdio: [
				"ignore",
				"pipe",
				"pipe",
				"ipc"
			],
			windowsHide: true /* BEAM_WINDOWS_HIDE_HOST */
		});`;
    if (!s.includes(needle)) {
      report.push(`WARN host spawn pattern miss ${path.relative(ROOT, file)}`);
    } else {
      s = s.replace(needle, repl);
      report.push(`host windowsHide → ${path.relative(ROOT, file)}`);
    }
  } else {
    report.push(`host windowsHide already ${path.relative(ROOT, file)}`);
  }

  // Login-shell probe (rare on win32) — hide if ever spawned.
  if (!s.includes("/* BEAM_WINDOWS_HIDE_SHELL */")) {
    const shellNeedle = `child = spawn(shell, ["-ilc", DUMP], {
				cwd,
				env: {
					...base,
					...PROBE_ENVIRONMENT
				},
				stdio: [
					"ignore",
					"pipe",
					"ignore"
				],
				detached: true
			});`;
    const shellRepl = `child = spawn(shell, ["-ilc", DUMP], {
				cwd,
				env: {
					...base,
					...PROBE_ENVIRONMENT
				},
				stdio: [
					"ignore",
					"pipe",
					"ignore"
				],
				detached: true,
				windowsHide: true /* BEAM_WINDOWS_HIDE_SHELL */
			});`;
    if (s.includes(shellNeedle)) {
      s = s.replace(shellNeedle, shellRepl);
      report.push(`shell probe windowsHide → ${path.relative(ROOT, file)}`);
    }
  }

  // Sync silent bridge boot after BEAM_LAUNCH_ENV IIFE (when .exe opened without VBS).
  const bootSync = `/* BEAM_SILENT_BRIDGE_BOOT: start local :17865 bridge with CREATE_NO_WINDOW when .exe is opened without VBS */
(function beamSilentBridgeBoot() {
	try {
		if (process.platform !== "win32") return;
		if (process.env.BEAM_BRIDGE_STARTED === "1") return;
		const beamRoot = process.env.BEAM_ROOT || dirname(process.execPath);
		const bridgeJs = join(beamRoot, "bridge", "server.js");
		const candidates = [
			join(beamRoot, "resources", "runtime", "primary-runtime", "dependencies", "node", "bin", "node.exe"),
			typeof process.env.BEAM_NODE === "string" ? process.env.BEAM_NODE : "",
		];
		let nodeExe = "";
		for (const c of candidates) {
			if (c && existsSync(c)) {
				nodeExe = c;
				break;
			}
		}
		if (!nodeExe || !existsSync(bridgeJs)) return;
		process.env.BEAM_BRIDGE_STARTED = "1";
		const child = spawn(nodeExe, [bridgeJs], {
			cwd: beamRoot,
			env: process.env,
			detached: true,
			stdio: "ignore",
			windowsHide: true,
		});
		child.unref();
	} catch {}
})();`;

  // Collapse accidental duplicate boots from prior runs, then ensure exactly one.
  const bootRe =
    /\/\* BEAM_SILENT_BRIDGE_BOOT:[\s\S]*?\(function beamSilentBridgeBoot\(\) \{[\s\S]*?\}\)\(\);\s*/g;
  const boots = s.match(bootRe) || [];
  if (boots.length !== 1) {
    if (boots.length > 1) {
      s = s.replace(bootRe, "");
      report.push(`deduped ${boots.length} bridge boots → ${path.relative(ROOT, file)}`);
    }
    const anchor = 'console.warn("beam launch env:", error);\n\t}\n})();';
    if (s.includes(anchor)) {
      s = s.replace(anchor, `${anchor}\n\n${bootSync}\n`);
      report.push(`silent bridge boot → ${path.relative(ROOT, file)}`);
    } else {
      const idx = s.indexOf('console.warn("beam launch env:"');
      if (idx !== -1) {
        const end = s.indexOf("})();", idx);
        if (end !== -1) {
          s = s.slice(0, end + 5) + "\n\n" + bootSync + "\n" + s.slice(end + 5);
          report.push(`silent bridge boot (fallback) → ${path.relative(ROOT, file)}`);
        }
      } else {
        report.push(`WARN BEAM_LAUNCH_ENV marker miss ${path.relative(ROOT, file)}`);
      }
    }
  } else {
    report.push(`silent bridge boot already ${path.relative(ROOT, file)}`);
  }

  if (s !== before) fs.writeFileSync(file, s);
}

const bridgeHiddenVbs = `' Launch node bridge with a fully hidden window (no console).
' Usage: wscript //nologo start-bridge-hidden.vbs <nodeExe> <scriptPath>
Option Explicit
Dim sh, nodeExe, scriptPath, cmd
Set sh = CreateObject("WScript.Shell")
If WScript.Arguments.Count < 2 Then WScript.Quit 1
nodeExe = WScript.Arguments(0)
scriptPath = WScript.Arguments(1)
cmd = """" & nodeExe & """ """ & scriptPath & """"
' 0 = SW_HIDE — never show a console for node.exe (console subsystem)
sh.Run cmd, 0, False
`;

const launcherVbs = `' Start Beam Agent fully silent — no cmd/powershell console.
' PROCESS env only (never writes BEAM_BASE_URL into ~/.beam/.env).
Option Explicit
Dim sh, fso, env, beamRoot, beamHome, electronUserData, nodeExe, bridgeJs, exePath, helper

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set env = sh.Environment("PROCESS")

beamRoot = fso.GetParentFolderName(WScript.ScriptFullName)
If Right(beamRoot, 1) <> "\\" Then beamRoot = beamRoot & "\\"

beamHome = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\\.beam"
electronUserData = beamHome & "\\electron-userdata"

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

' Kill previous bridge on :17865 (hidden cmd; no flash when window style = 0)
sh.Run "cmd /c for /f ""tokens=5"" %P in ('netstat -ano ^| findstr "":17865"" ^| findstr LISTENING') do taskkill /F /PID %P >nul 2>&1", 0, True

nodeExe = FindNode(beamRoot)
bridgeJs = beamRoot & "bridge\\server.js"
exePath = beamRoot & "Beam Agent.exe"
helper = beamRoot & "start-bridge-hidden.vbs"

If nodeExe <> "" And fso.FileExists(bridgeJs) Then
  env("BEAM_NODE") = nodeExe
  If fso.FileExists(helper) Then
    sh.Run "wscript //nologo """ & helper & """ """ & nodeExe & """ """ & bridgeJs & """", 0, False
  Else
    sh.Run """" & nodeExe & """ """ & bridgeJs & """", 0, False
  End If
  WScript.Sleep 1200
End If

If fso.FileExists(exePath) Then
  ' 1 = normal Electron GUI window (not a console)
  sh.Run """" & exePath & """ --user-data-dir=""" & electronUserData & """", 1, False
End If

WScript.Quit 0

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
  Dim fsoLocal, shLocal, cand, pf, outFile, ts, line
  Set fsoLocal = CreateObject("Scripting.FileSystemObject")
  Set shLocal = CreateObject("WScript.Shell")
  FindNode = ""

  ' Prefer bundled node (no PATH lookup → no cmd flash)
  cand = root & "resources\\runtime\\primary-runtime\\dependencies\\node\\bin\\node.exe"
  If fsoLocal.FileExists(cand) Then
    FindNode = cand
    Exit Function
  End If

  pf = shLocal.ExpandEnvironmentStrings("%ProgramFiles%") & "\\nodejs\\node.exe"
  If fsoLocal.FileExists(pf) Then
    FindNode = pf
    Exit Function
  End If

  outFile = shLocal.ExpandEnvironmentStrings("%TEMP%") & "\\beam-where-node.txt"
  shLocal.Run "cmd /c where node > """ & outFile & """ 2>nul", 0, True
  If fsoLocal.FileExists(outFile) Then
    Set ts = fsoLocal.OpenTextFile(outFile, 1)
    If Not ts.AtEndOfStream Then
      line = Trim(ts.ReadLine)
      If line <> "" And fsoLocal.FileExists(line) Then FindNode = line
    End If
    ts.Close
    On Error Resume Next
    fsoLocal.DeleteFile outFile, True
    On Error GoTo 0
  End If
End Function
`;

function writeLaunchers() {
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, "start-bridge-hidden.vbs"), bridgeHiddenVbs.replace(/\n/g, "\r\n"));
  fs.writeFileSync(path.join(DIST, "Start Beam Agent.vbs"), launcherVbs.replace(/\n/g, "\r\n"));

  // .cmd is NEVER the user entry — always delegates; still flashes if double-clicked.
  // Prefer Start Beam Agent.vbs / desktop shortcut (wscript).
  const distCmd = `@echo off\r\nREM Do not double-click this file — use "Start Beam Agent.vbs" or the desktop shortcut (silent).\r\nstart "" /B wscript //nologo "%~dp0Start Beam Agent.vbs"\r\nexit /b 0\r\n`;
  fs.writeFileSync(path.join(DIST, "Start Beam Agent.cmd"), distCmd);

  const loginVbs = `' Silent Assistix ID login entry — opens Beam Agent GUI only (no console).
Option Explicit
Dim sh, fso, root, exePath
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
If Right(root, 1) <> "\\" Then root = root & "\\"
exePath = root & "Beam Agent.exe"
If fso.FileExists(exePath) Then
  sh.Run """" & exePath & """", 1, False
Else
  sh.Run "wscript //nologo """ & root & "Start Beam Agent.vbs""", 0, False
End If
`;
  fs.writeFileSync(path.join(DIST, "ASSISTIX ID Login.vbs"), loginVbs.replace(/\n/g, "\r\n"));
  fs.writeFileSync(
    path.join(DIST, "ASSISTIX ID Login.cmd"),
    `@echo off\r\nstart "" /B wscript //nologo "%~dp0ASSISTIX ID Login.vbs"\r\nexit /b 0\r\n`
  );

  fs.writeFileSync(
    path.join(ROOT, "Start Beam Agent.vbs"),
    `' Root convenience — silent launch (no console).\r\nSet sh = CreateObject("WScript.Shell")\r\nSet fso = CreateObject("Scripting.FileSystemObject")\r\nroot = fso.GetParentFolderName(WScript.ScriptFullName)\r\nsh.Run "wscript //nologo """ & root & "\\dist\\Beam Agent\\Start Beam Agent.vbs""", 0, False\r\n`
  );
  fs.writeFileSync(
    path.join(ROOT, "Start Beam Agent.cmd"),
    `@echo off\r\nREM Prefer Start Beam Agent.vbs (silent). This .cmd may flash once if opened directly.\r\nstart "" /B wscript //nologo "%~dp0dist\\Beam Agent\\Start Beam Agent.vbs"\r\nexit /b 0\r\n`
  );
  report.push("launchers rewritten (VBS primary)");
}

function writeIdentityPs1() {
  const ps1 = path.join(ROOT, "desktop", "_windows-beam-identity.ps1");
  const body = `# Beam Agent Windows identity + SILENT shortcuts (wscript + VBS — never .cmd/.exe)
$ErrorActionPreference = 'SilentlyContinue'
$report = @()

$beamSrc = 'C:\\Users\\Alexa\\OneDrive\\Documents\\Beam Agent\\dist\\Beam Agent'
$beamDst = Join-Path $env:LOCALAPPDATA 'Programs\\Beam Agent'
$legacy = Join-Path $env:LOCALAPPDATA 'Programs\\DeepSeek Harness'
$vbs = Join-Path $beamSrc 'Start Beam Agent.vbs'
$wscript = Join-Path $env:SystemRoot 'System32\\wscript.exe'

New-Item -ItemType Directory -Force -Path $beamDst | Out-Null
$lnkDir = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
New-Item -ItemType Directory -Force -Path $lnkDir | Out-Null

function Set-BeamSilentShortcut([string]$lnkPath) {
  $WshShell = New-Object -ComObject WScript.Shell
  $shortcut = $WshShell.CreateShortcut($lnkPath)
  $shortcut.TargetPath = $wscript
  $shortcut.Arguments = '//nologo "' + $vbs + '"'
  $shortcut.WorkingDirectory = $beamSrc
  $shortcut.IconLocation = (Join-Path $beamSrc 'Beam Agent.exe')
  $shortcut.WindowStyle = 7
  $shortcut.Description = 'Beam Agent'
  $shortcut.Save()
}

Set-BeamSilentShortcut (Join-Path $lnkDir 'Beam Agent.lnk')
$report += "StartMenu:wscript+vbs"

$desk = [Environment]::GetFolderPath('Desktop')
Set-BeamSilentShortcut (Join-Path $desk 'Beam Agent.lnk')
$report += "Desktop:wscript+vbs"

$taskbar = Join-Path $env:APPDATA 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar\\Beam Agent.lnk'
if (Test-Path $taskbar) {
  Set-BeamSilentShortcut $taskbar
  $report += "Taskbar:wscript+vbs"
}

Get-ChildItem $lnkDir -Recurse -Filter '*DeepSeek*' | Remove-Item -Force
Get-ChildItem $lnkDir -Recurse -Filter '*Harness*' | Where-Object { $_.Name -notmatch 'Beam' } | Remove-Item -Force
Get-ChildItem $desk -Filter '*DeepSeek*' | Remove-Item -Force

$mui = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache'
$beamExe = Join-Path $beamSrc 'Beam Agent.exe'
if (Test-Path $mui) {
  New-ItemProperty -Path $mui -Name ($beamExe + '.FriendlyAppName') -Value 'Beam Agent' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $mui -Name ($beamExe + '.ApplicationCompany') -Value 'ASSISTIX' -PropertyType String -Force | Out-Null
  Get-Item $mui | Select-Object -ExpandProperty Property | Where-Object { $_ -match 'DeepSeek Harness' } | ForEach-Object {
    Remove-ItemProperty -Path $mui -Name $_ -Force
    $report += "MuiCacheRemoved:$_"
  }
}

$unKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
Get-ChildItem $unKey | ForEach-Object {
  $p = Get-ItemProperty $_.PSPath
  if ($p.InstallLocation -match 'DeepSeek Harness' -or $p.DisplayName -match 'DeepSeek|Harness' -or $p.DisplayName -match 'Beam Agent \\(legacy') {
    Set-ItemProperty $_.PSPath -Name DisplayName -Value 'Beam Agent'
    Set-ItemProperty $_.PSPath -Name InstallLocation -Value $beamSrc
    Set-ItemProperty $_.PSPath -Name DisplayIcon -Value ((Join-Path $beamSrc 'Beam Agent.exe') + ',0')
    Set-ItemProperty $_.PSPath -Name Publisher -Value 'ASSISTIX'
    $report += "UninstallRewrote:$($_.PSChildName)"
  }
}

@"
Beam Agent
Install root: $beamSrc
Silent launch: wscript //nologo Start Beam Agent.vbs
Do not pin Beam Agent.exe — pin the Start Menu / Desktop shortcut (VBS).
"@ | Set-Content -Encoding UTF8 (Join-Path $beamDst 'README-BEAM.txt')

if (Test-Path (Join-Path $legacy 'DeepSeek Harness.exe')) {
  $retired = Join-Path $legacy '_RETIRED_DeepSeek_Harness.exe'
  if (-not (Test-Path $retired)) {
    Rename-Item (Join-Path $legacy 'DeepSeek Harness.exe') '_RETIRED_DeepSeek_Harness.exe' -Force
    $report += 'RetiredLegacyExe'
  }
}
if (Test-Path (Join-Path $legacy 'Uninstall DeepSeek Harness.exe')) {
  Rename-Item (Join-Path $legacy 'Uninstall DeepSeek Harness.exe') '_RETIRED_Uninstall.exe' -Force -ErrorAction SilentlyContinue
  $report += 'RetiredLegacyUninstaller'
}

$report | ForEach-Object { Write-Host $_ }
Write-Host 'WINDOWS_SCRUB_DONE'
`;
  fs.writeFileSync(ps1, body);
  report.push("wrote _windows-beam-identity.ps1 (silent shortcuts)");
}

function updateShortcutsNow() {
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
$beamSrc = '${DIST.replace(/\\/g, "\\\\")}'
$vbs = Join-Path $beamSrc 'Start Beam Agent.vbs'
$wscript = Join-Path $env:SystemRoot 'System32\\wscript.exe'
$icon = Join-Path $beamSrc 'Beam Agent.exe'
$Wsh = New-Object -ComObject WScript.Shell
function Set-Silent($p) {
  if (-not (Test-Path $vbs)) { return }
  $dir = Split-Path $p -Parent
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $s = $Wsh.CreateShortcut($p)
  $s.TargetPath = $wscript
  $s.Arguments = '//nologo "' + $vbs + '"'
  $s.WorkingDirectory = $beamSrc
  $s.IconLocation = $icon
  $s.WindowStyle = 7
  $s.Description = 'Beam Agent'
  $s.Save()
  Write-Output "ok:$p"
}
$desk = [Environment]::GetFolderPath('Desktop')
@(
  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Beam Agent.lnk'),
  (Join-Path $desk 'Beam Agent.lnk'),
  (Join-Path $env:APPDATA 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar\\Beam Agent.lnk')
) | ForEach-Object { Set-Silent $_ }
`;
  const tmp = path.join(os.tmpdir(), "beam-silent-shortcuts.ps1");
  fs.writeFileSync(tmp, ps);
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp],
    { encoding: "utf8", windowsHide: true }
  );
  report.push((r.stdout || "").trim() || "shortcuts updated");
  if (r.status !== 0) report.push(`shortcut warn: ${(r.stderr || "").trim()}`);
}

function fixDetachHarnessRegression() {
  const file = path.join(ROOT, "desktop", "beam-detach-harness.mjs");
  if (!fs.existsSync(file)) return;
  let s = fs.readFileSync(file, "utf8");
  const bad = `$s.TargetPath = $beamExe
  $s.WorkingDirectory = Split-Path $beamExe
  $s.Description = 'Beam Agent'
  $s.Save()`;
  const good = `$s.TargetPath = Join-Path $env:SystemRoot 'System32\\\\wscript.exe'
  $s.Arguments = '//nologo "C:\\\\Users\\\\Alexa\\\\OneDrive\\\\Documents\\\\Beam Agent\\\\dist\\\\Beam Agent\\\\Start Beam Agent.vbs"'
  $s.WorkingDirectory = Split-Path $beamExe
  $s.WindowStyle = 7
  $s.IconLocation = $beamExe
  $s.Description = 'Beam Agent'
  $s.Save()`;
  if (s.includes("$s.TargetPath = $beamExe")) {
    s = s.replace(bad, good);
    fs.writeFileSync(file, s);
    report.push("fixed beam-detach-harness.mjs shortcut → wscript+vbs");
  }

  const scrub = path.join(ROOT, "desktop", "_tmp_windows_scrub.ps1");
  if (fs.existsSync(scrub)) {
    let p = fs.readFileSync(scrub, "utf8");
    if (p.includes("$s.TargetPath = $beamExe")) {
      p = p.replace(
        `$s.TargetPath = $beamExe
  $s.WorkingDirectory = Split-Path $beamExe
  $s.Description = 'Beam Agent'
  $s.Save()`,
        `$s.TargetPath = Join-Path $env:SystemRoot 'System32\\wscript.exe'
  $s.Arguments = '//nologo "C:\\Users\\Alexa\\OneDrive\\Documents\\Beam Agent\\dist\\Beam Agent\\Start Beam Agent.vbs"'
  $s.WorkingDirectory = Split-Path $beamExe
  $s.WindowStyle = 7
  $s.IconLocation = $beamExe
  $s.Description = 'Beam Agent'
  $s.Save()`
      );
      fs.writeFileSync(scrub, p);
      report.push("fixed _tmp_windows_scrub.ps1 → wscript+vbs");
    }
  }
}

for (const f of MAIN_FILES) patchMainWindowsHide(f);
writeLaunchers();
writeIdentityPs1();
fixDetachHarnessRegression();
updateShortcutsNow();

console.log(JSON.stringify({ ok: true, report }, null, 2));
