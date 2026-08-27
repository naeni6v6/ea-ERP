@echo off
rem MotionBridge ERP stop script. All logic lives in scripts\stop.ps1 (Korean-safe).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
