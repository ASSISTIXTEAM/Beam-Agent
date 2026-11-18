# Fix Windows MuiCache / jump-list name for Beam Agent
$mui="HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache"
$exe="C:\Users\Alexa\OneDrive\Documents\Beam Agent\dist\Beam Agent\Beam Agent.exe"
Set-ItemProperty -Path $mui -Name "$exe.FriendlyAppName" -Value "Beam Agent" -Type String -Force
Set-ItemProperty -Path $mui -Name "$exe.ApplicationCompany" -Value "ASSISTIX" -Type String -Force
Write-Host "MuiCache -> Beam Agent"
