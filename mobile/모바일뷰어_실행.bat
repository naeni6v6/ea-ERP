@echo off
rem MotionBridge mobile viewer launcher (see the app on this PC).
rem All logic and Korean messages live in start-viewer.ps1 (Korean-safe, UTF-8 BOM).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-viewer.ps1"
