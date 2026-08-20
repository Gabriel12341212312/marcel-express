@echo off
title Marcel Express - Server stop
echo Stoppe den Vite-Dev-Server auf Port 5173 ...
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1 && echo Prozess %%a beendet.
  set FOUND=1
)
if "%FOUND%"=="0" echo Kein laufender Server gefunden.
pause