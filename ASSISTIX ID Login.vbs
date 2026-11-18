' Silent Assistix ID login entry — opens Beam Agent GUI only (no console).
Option Explicit
Dim sh, fso, root, exePath
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
If Right(root, 1) <> "\" Then root = root & "\"
exePath = root & "Beam Agent.exe"
If fso.FileExists(exePath) Then
  sh.Run """" & exePath & """", 1, False
Else
  sh.Run "wscript //nologo """ & root & "Start Beam Agent.vbs""", 0, False
End If
