@echo off
rem MotionBridge ERP one-click launcher. All logic lives in scripts\run.ps1 (Korean-safe).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run.ps1"
