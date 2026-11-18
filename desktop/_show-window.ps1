$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ShowWin {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
}
"@
$targets = @(Get-Process 'Beam Agent' -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$found = @()
[ShowWin]::EnumWindows({
  param($h, $l)
  [uint32]$proc = 0
  [ShowWin]::GetWindowThreadProcessId($h, [ref]$proc) | Out-Null
  if ($targets -contains [int]$proc) {
    $len = [ShowWin]::GetWindowTextLength($h)
    $vis = [ShowWin]::IsWindowVisible($h)
    $found += "proc=$proc vis=$vis len=$len hwnd=$h"
    [ShowWin]::ShowWindow($h, 9) | Out-Null  # SW_RESTORE
    [ShowWin]::SetForegroundWindow($h) | Out-Null
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
$found | ForEach-Object { $_ }
Write-Host "targets:" ($targets -join ',')
