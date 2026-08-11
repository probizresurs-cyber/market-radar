@echo off
chcp 65001 >nul
title HH Parser - Local Worker
echo ============================================
echo   HH Parser - локальный воркер парсинга
echo ============================================
echo.
echo [1/2] Открываю SSH-туннель к VPS...
echo       Когда спросит пароль - введите: Radar
echo.
start "HH-Tunnel (НЕ ЗАКРЫВАТЬ пока парсишь)" cmd /k "ssh -N -L 5433:localhost:5432 maria@72.56.241.159"
echo Жду установления туннеля (8 сек)...
timeout /t 8 /nobreak >nul
echo.
echo [2/2] Запускаю воркер...
echo.
cd /d "%~dp0"
node --env-file=.env.worker local-worker.mjs
echo.
echo Воркер остановлен. Можно закрыть окно туннеля.
pause
