# Beam Agent Windows identity + SILENT shortcuts (wscript + VBS — never .cmd/.exe)
$ErrorActionPreference = 'SilentlyContinue'
$report = @()

$beamSrc = 'C:\Beam-Agent\dist\Beam-Agent'
$beamDst = Join-Path $env:LOCALAPPDATA 'Programs\Beam-Agent'
$legacy = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'
$vbs = Join-Path $beamSrc 'Start Beam Agent.vbs'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'

New-Item -ItemType Directory -Force -Path $beamDst | Out-Null
$lnkDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
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

$taskbar = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Beam Agent.lnk'
if (Test-Path $taskbar) {
  Set-BeamSilentShortcut $taskbar
  $report += "Taskbar:wscript+vbs"
}

Get-ChildItem $lnkDir -Recurse -Filter '*DeepSeek*' | Remove-Item -Force
Get-ChildItem $lnkDir -Recurse -Filter '*Harness*' | Where-Object { $_.Name -notmatch 'Beam' } | Remove-Item -Force
Get-ChildItem $desk -Filter '*DeepSeek*' | Remove-Item -Force

$mui = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache'
$beamExe = Join-Path $beamSrc 'Beam Agent.exe'
if (Test-Path $mui) {
  New-ItemProperty -Path $mui -Name ($beamExe + '.FriendlyAppName') -Value 'Beam Agent' -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $mui -Name ($beamExe + '.ApplicationCompany') -Value 'ASSISTIX' -PropertyType String -Force | Out-Null
  Get-Item $mui | Select-Object -ExpandProperty Property | Where-Object { $_ -match 'DeepSeek Harness' } | ForEach-Object {
    Remove-ItemProperty -Path $mui -Name $_ -Force
    $report += "MuiCacheRemoved:$_"
  }
}

$unKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
Get-ChildItem $unKey | ForEach-Object {
  $p = Get-ItemProperty $_.PSPath
  if ($p.InstallLocation -match 'DeepSeek Harness' -or $p.DisplayName -match 'DeepSeek|Harness' -or $p.DisplayName -match 'Beam Agent \(legacy') {
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
