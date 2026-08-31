@echo off
rem MotionBridge mobile app launcher (shows Expo QR).
rem All logic and Korean messages live in start-expo.ps1 (Korean-safe, UTF-8 BOM).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-expo.ps1"
