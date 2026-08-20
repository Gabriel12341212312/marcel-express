@echo off
title Marcel Express - Server start
cd /d "%~dp0"
echo Starte den Vite-Dev-Server ...
echo URL: http://localhost:5173
echo Stoppen: stop-server.bat ausfuehren oder dieses Fenster schliessen.
call npm run dev
pause