/**
 * Beam Agent — full DeepSeek/Harness identity + path scrub (code + Windows install).
 * Keeps internal npm package names (@deepseek-ai/*) — those are not user-facing.
 * User-facing paths, exe metadata sources, env, comments, chrome → Beam Agent only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TREES = [
  path.join(ROOT, "runtime", "app"),
  path.join(ROOT, "dist", "Beam-Agent", "resources", "app"),
].filter((p) => fs.existsSync(p));

const report = { files: [], windows: [], notes: [] };

function write(file, s) {
  fs.writeFileSync(file, s);
  report.files.push(file);
}

function patchFile(file, fn) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    write(file, after);
    return true;
  }
  return false;
}

// --- 1) main.js home env + comments ---
for (const tree of TREES) {
  const mainJs = path.join(tree, "lib", "main.js");
  patchFile(mainJs, (s) => {
    s = s.replace(
      `const DSH_HOME_ENV = "DSH_HOME";`,
      `const DSH_HOME_ENV = "BEAM_HOME";\n/** Legacy alias still honored via resolveDshHome. */\nconst DSH_HOME_ENV_LEGACY = "DSH_HOME";`
    );
    // Prefer BEAM_HOME then DSH_HOME
    s = s.replace(
      `function resolveDshHome(configured, env = process.env) {
	return resolveRoot(configured, env, DSH_HOME_ENV, defaultDshHome);
}`,
      `function resolveDshHome(configured, env = process.env) {
	if (configured) return resolveRoot(configured, env, DSH_HOME_ENV, defaultDshHome);
	const beam = env.BEAM_HOME;
	if (beam !== undefined && String(beam).trim()) return resolve(expandHomePath(beam));
	const legacy = env.DSH_HOME;
	if (legacy !== undefined && String(legacy).trim()) return resolve(expandHomePath(legacy));
	return defaultDshHome();
}`
    );
    s = s.replace(/Harness home shared with npm-installed dsh\./g, "Beam Agent home under ~/.beam.");
    s = s.replace(/`~\/\.dsh`/g, "`~/.beam`");
    s = s.replace(/\$DSH_HOME/g, "$BEAM_HOME");
    s = s.replace(
      "desktop welcome: missing official DeepSeek credential reference",
      "desktop welcome: missing official ASSISTIX credential reference"
    );
    // Restore EN chrome that leaked Cyrillic into desktop shell dicts is handled separately
    return s;
  });
}

// --- 2) Start scripts: Beam-first env names ---
for (const cmd of [
  path.join(ROOT, "dist", "Beam-Agent", "Start Beam Agent.cmd"),
  path.join(ROOT, "Start Beam Agent.cmd"),
]) {
  patchFile(cmd, (s) => {
    // Keep DEEPSEEK_* only as bridge-compat aliases; prefer BEAM_* names in comments
    if (!s.includes("BEAM_API_KEY")) {
      s = s.replace(
        'set "DEEPSEEK_API_KEY=beam-assistix-local"\nset "DEEPSEEK_BASE_URL=http://127.0.0.1:17865/anthropic"',
        'set "BEAM_API_KEY=beam-assistix-local"\nset "BEAM_BASE_URL=http://127.0.0.1:17865/anthropic"\nREM Internal provider still reads DEEPSEEK_* credential refs:\nset "DEEPSEEK_API_KEY=%BEAM_API_KEY%"\nset "DEEPSEEK_BASE_URL=%BEAM_BASE_URL%"'
      );
    }
    s = s.replace(/DeepSeek Harness/gi, "Beam Agent");
    return s;
  });
}

// --- 3) Bridge comments ---
for (const bridge of [
  path.join(ROOT, "desktop", "bridge", "server.js"),
  path.join(ROOT, "dist", "Beam-Agent", "bridge", "server.js"),
]) {
  patchFile(bridge, (s) => {
    s = s.replace(
      "Anthropic Messages API (what DeepSeek Harness speaks)",
      "Anthropic Messages API (Beam Agent desktop)"
    );
    s = s.replace(
      "or Harness marks every entry unusable",
      "or the desktop client marks every entry unusable"
    );
    s = s.replace("used by Harness:", "used by Beam Agent:");
    return s;
  });
}

// --- 4) Fix remaining Cyrillic-in-EN in three client packages ---
const enRestores = [
  {
    file: "dsh-client-ui-agent-preset/lib/client.js",
    pairs: [
      ["Стандартный режим for everyday tasks, or Creator mo", "Standard mode for everyday tasks, or Creator mo"],
    ],
  },
  {
    file: "dsh-client-ui-conversation/lib/client.js",
    pairs: [["Выбрать рабочую область", "Select workspace"]],
  },
  {
    file: "dsh-client-ui-sidebar/lib/client.js",
    pairs: [["Открыть боковую панель", "Open sidebar"]],
  },
];

for (const tree of TREES) {
  const ai = path.join(tree, "dsh", "node_modules", "@deepseek-ai");
  for (const item of enRestores) {
    const f = path.join(ai, item.file);
    patchFile(f, (s) => {
      const mark = s.indexOf("// #region beam-ru");
      let head = mark > 0 ? s.slice(0, mark) : s;
      let tail = mark > 0 ? s.slice(mark) : "";
      for (const [a, b] of item.pairs) {
        // only in EN half
        head = head.split(a).join(b);
      }
      return head + tail;
    });
  }
}

// --- 5) index.html: sync dataset.beamLang from live lang (flash-free switch) ---
for (const tree of TREES) {
  const html = path.join(
    tree,
    "dsh",
    "node_modules",
    "@deepseek-ai",
    "dsh-web-frontend",
    "dist",
    "index.html"
  );
  patchFile(html, (s) => {
    s = s.replace(
      `try { if (isRu() && !document.documentElement.lang.startsWith("en")) document.documentElement.lang = "ru-RU"; } catch {}`,
      `try {
        const lang = (document.documentElement.lang || "").toLowerCase();
        if (lang.startsWith("en")) document.documentElement.dataset.beamLang = "en";
        else if (lang.startsWith("zh")) document.documentElement.dataset.beamLang = "zh";
        else if (lang.startsWith("ru")) document.documentElement.dataset.beamLang = "ru";
      } catch {}`
    );
    return s;
  });
}

// --- 6) Windows: migrate install, registry, shortcuts (via PowerShell) ---
const ps1 = path.join(ROOT, "desktop", "_windows-beam-identity.ps1");
fs.writeFileSync(
  ps1,
  `# Beam Agent Windows identity scrub — run elevated-friendly, current user
$ErrorActionPreference = 'SilentlyContinue'
$report = @()

$beamSrc = 'C:\\Beam-Agent\\dist\\Beam-Agent'
$beamDst = Join-Path $env:LOCALAPPDATA 'Programs\\Beam-Agent'
$legacy = Join-Path $env:LOCALAPPDATA 'Programs\\DeepSeek Harness'

# Ensure Programs\\Beam-Agent has current build (junction/copy of launcher files)
New-Item -ItemType Directory -Force -Path $beamDst | Out-Null
# Copy essential launchers (not full electron tree if huge — prefer shortcut to dist)
$lnkDir = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
New-Item -ItemType Directory -Force -Path $lnkDir | Out-Null

$WshShell = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $lnkDir 'Beam Agent.lnk'
$shortcut = $WshShell.CreateShortcut($lnkPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\\wscript.exe'
$shortcut.Arguments = '//nologo "' + (Join-Path $beamSrc 'Start Beam Agent.vbs') + '"'
$shortcut.WorkingDirectory = $beamSrc
$shortcut.IconLocation = (Join-Path $beamSrc 'Beam Agent.exe')
$shortcut.WindowStyle = 7
$shortcut.Description = 'Beam Agent'
$shortcut.Save()
$report += "StartMenu:$lnkPath"

# Desktop shortcut
$desk = [Environment]::GetFolderPath('Desktop')
$deskLnk = Join-Path $desk 'Beam Agent.lnk'
$ds = $WshShell.CreateShortcut($deskLnk)
$ds.TargetPath = Join-Path $env:SystemRoot 'System32\\wscript.exe'
$ds.Arguments = '//nologo "' + (Join-Path $beamSrc 'Start Beam Agent.vbs') + '"'
$ds.WorkingDirectory = $beamSrc
$ds.IconLocation = (Join-Path $beamSrc 'Beam Agent.exe')
$ds.WindowStyle = 7
$ds.Description = 'Beam Agent'
$ds.Save()
$report += "Desktop:$deskLnk"

# Remove DeepSeek Harness start menu leftovers
Get-ChildItem $lnkDir -Recurse -Filter '*DeepSeek*' | Remove-Item -Force
Get-ChildItem $lnkDir -Recurse -Filter '*Harness*' | Where-Object { $_.Name -notmatch 'Beam' } | Remove-Item -Force
Get-ChildItem $desk -Filter '*DeepSeek*' | Remove-Item -Force

# MuiCache: set Beam Agent.exe friendly name; clear DeepSeek Harness friendly names pointing at our exe
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

# Uninstall key: rewrite legacy DeepSeek Harness entry to Beam Agent pointing at dist
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

# Write a marker so Programs\\Beam-Agent points users to the right place
@"
Beam Agent
Install root: $beamSrc
Do not use Local\\Programs\\DeepSeek Harness — that folder is legacy and unused by Beam Agent.
"@ | Set-Content -Encoding UTF8 (Join-Path $beamDst 'README-BEAM.txt')

# Soft-disable legacy launcher: rename exe so jump lists / pins break away from Harness name
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

# Clear AutomaticDestinations / CustomDestinations jump list cache bits for our app (best-effort)
$auto = Join-Path $env:APPDATA 'Microsoft\\Windows\\Recent\\AutomaticDestinations'
$custom = Join-Path $env:APPDATA 'Microsoft\\Windows\\Recent\\CustomDestinations'
# do not wipe all; only touch if we know ids — skip destructive wipe

$report | ForEach-Object { Write-Host $_ }
Write-Host 'WINDOWS_SCRUB_DONE'
`
);
try {
  const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1}"`, {
    encoding: "utf8",
    timeout: 60000,
  });
  report.windows = out.split(/\r?\n/).filter(Boolean);
} catch (e) {
  report.windows = ["ERROR", String(e.stderr || e.message || e)];
}

// --- 7) .env: API keys only (never write BEAM_BASE_URL / BEAM_HOME — launcher PROCESS env) ---
const envFile = path.join(process.env.USERPROFILE || "", ".beam", ".env");
if (fs.existsSync(envFile)) {
  const banned = /^(BEAM_BASE_URL|BEAM_HOME|DEEPSEEK_BASE_URL|DSH_HOME|DEEPSEEK_SEARCH_BASE_URL)=/i;
  const lines = fs
    .readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !banned.test(l));
  let env = lines.join("\n");
  if (!/BEAM_API_KEY=/i.test(env)) {
    const key = (env.match(/DEEPSEEK_API_KEY=(.+)/i) || [])[1] || "beam-assistix-local";
    env = `BEAM_API_KEY=${key}\n` + env;
  }
  if (!/DEEPSEEK_API_KEY=/i.test(env)) {
    const key = (env.match(/BEAM_API_KEY=(.+)/i) || [])[1] || "beam-assistix-local";
    env += (env.endsWith("\n") ? "" : "\n") + `DEEPSEEK_API_KEY=${key}\n`;
  }
  fs.writeFileSync(envFile, env.endsWith("\n") ? env : env + "\n");
  report.notes.push("Updated ~/.beam/.env with API keys only (no launcher-forbidden keys)");
}

report.notes.push(
  "Internal npm scopes @deepseek-ai/* remain (runtime packages). User-facing identity is Beam Agent / ASSISTIX / ~/.beam / Assistix.BeamAgent."
);
report.notes.push(
  "Legacy folder %LOCALAPPDATA%\\Programs\\DeepSeek Harness retired (exe renamed). Use dist\\Beam-Agent or Start Menu 'Beam Agent'."
);

console.log(JSON.stringify(report, null, 2));
