' Launch node bridge with a fully hidden window (no console).
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
