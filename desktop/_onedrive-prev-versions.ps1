# List Previous Versions for bridge/server.js via Shell.Application
$path = "C:\Users\Alexa\OneDrive\Documents\Beam Agent\desktop\bridge\server.js"
$dir = Split-Path $path
$name = Split-Path $path -Leaf

$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace($dir)
if (-not $folder) { Write-Host "no folder"; exit 1 }

# Enumerate items; also try opening "Previous Versions" property
$item = $folder.ParseName($name)
if (-not $item) { Write-Host "no item"; exit 1 }

Write-Host "Item:" $item.Path
Write-Host "Size:" $item.Size
Write-Host "ModifyDate:" $item.ModifyDate

# Try to get extended property "System.FileOwner" etc.
for ($i = 0; $i -lt 320; $i++) {
  $det = $folder.GetDetailsOf($item, $i)
  $hdr = $folder.GetDetailsOf($null, $i)
  if ($det -and $hdr -match 'version|предыдущ|size|размер|измен') {
    Write-Host "$i [$hdr] = $det"
  }
}

# Copy from Volume Shadow if accessible without admin via Win32_ShadowCopy paths
Get-CimInstance -ClassName Win32_ShadowCopy -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Shadow:" $_.DeviceObject $_.InstallDate
  $candidate = $_.DeviceObject + "\Users\Alexa\OneDrive\Documents\Beam Agent\desktop\bridge\server.js"
  if (Test-Path $candidate) {
    Write-Host "FOUND shadow copy:" $candidate ((Get-Item $candidate).Length)
  }
}
