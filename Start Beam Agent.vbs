' Root convenience — silent launch (no console).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "wscript //nologo """ & root & "\dist\Beam Agent\Start Beam Agent.vbs""", 0, False
