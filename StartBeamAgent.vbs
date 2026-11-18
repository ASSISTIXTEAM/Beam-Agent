' Space-free root launcher name.
Option Explicit
Dim sh, vbs
Set sh = CreateObject("WScript.Shell")
vbs = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\BeamAgent\StartBeamAgent.vbs"
sh.Run "wscript.exe //nologo """ & vbs & """", 0, False
