@echo off
REM Prefer Start Beam Agent.vbs (silent). This .cmd may flash once if opened directly.
start "" /B wscript //nologo "%~dp0dist\Beam-Agent\Start Beam Agent.vbs"
exit /b 0
