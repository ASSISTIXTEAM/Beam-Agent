; Beam Agent — Windows installer
; SourceDir / OutDir / IconFile can be overridden via ISCC /D flags (packager uses short SUBST paths).
#define MyAppName "Beam Agent"
#define MyAppVersion "0.1.6"
#define MyAppPublisher "ASSISTIX"
#define MyAppURL "https://agent.assistix.org/download/"
#define MyAppExeName "Start Beam Agent.vbs"
#ifndef SourceDir
  #define SourceDir "..\..\dist\Beam Agent"
#endif
#ifndef OutDir
  #define OutDir "..\..\dist\installers"
#endif
#ifndef IconFile
  #define IconFile "..\..\dist\Beam Agent\resources\app.ico"
#endif

[Setup]
AppId={{A7C3E2B1-9F44-4D6A-8E21-BEAMAGENT0001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://assistix.org
AppSupportURL=https://agent.assistix.org
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\Beam Agent
DefaultGroupName=Beam Agent
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutDir}
OutputBaseFilename=Beam-Agent-0.1.6-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\resources\app.ico
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
VersionInfoVersion=0.1.6.0
VersionInfoCompany=ASSISTIX
VersionInfoDescription=Beam Agent Setup
VersionInfoProductName=Beam Agent
VersionInfoProductVersion=0.1.6.0
InfoBeforeFile=info-before.txt

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Ярлык на рабочем столе / Desktop shortcut"; GroupDescription: "Дополнительно / Additional:"; Flags: unchecked

[Files]
; Full Electron app + bridge + bundled Node runtime. Exclude secrets / local env / logs / huge unused inspector docs.
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.env,.env,.env.*,*.log,beam-stderr.log,beam-stdout.log,_beam-stderr.log,_beam-stdout.log"

[Icons]
Name: "{group}\Beam Agent (Early Alpha)"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\resources\app.ico"; Comment: "Beam Agent — Early Alpha (ASSISTIX)"
Name: "{group}\Удалить Beam Agent"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Beam Agent"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\resources\app.ico"; Tasks: desktopicon

[Run]
; Interactive installs: optional checkbox. Silent/auto-update installs: always relaunch.
Filename: "{app}\{#MyAppExeName}"; Description: "Запустить Beam Agent / Launch Beam Agent"; Flags: nowait postinstall skipifsilent shellexec
Filename: "{app}\{#MyAppExeName}"; Flags: nowait postinstall skipifnotsilent shellexec

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
