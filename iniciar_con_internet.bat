@echo off
title Servidor Fenix + Acceso Internet
color 0A
echo.
echo  =========================================
echo     INICIANDO SERVIDOR FENIX + INTERNET
echo  =========================================
echo.

:: Matar cualquier servidor node viejo
echo  [1/3] Cerrando servidores anteriores...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Iniciar servidor en segundo plano
echo  [2/3] Iniciando servidor local...
start "Servidor Fenix Node" /min cmd /k "cd /d "%~dp0" && "tools\node_portable\node.exe" server.js"

:: Esperar 5 segundos para que el servidor arranque bien
echo  Esperando que el servidor encienda...
timeout /t 5 /nobreak >nul

:: Verificar que el servidor responde
echo  [3/3] Verificando servidor...
powershell -Command "try { $r = Invoke-WebRequest http://localhost:8000 -UseBasicParsing -TimeoutSec 3; Write-Host ' Servidor OK' -ForegroundColor Green } catch { Write-Host ' ADVERTENCIA: servidor puede no estar listo aun' -ForegroundColor Yellow }"

echo.
echo  =========================================
echo   Creando tunel de internet...
echo   La URL publica aparecera ABAJO en verde
echo   Compartela con tu equipo!
echo  =========================================
echo.

:: Crear tunel SSH
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:8000 serveo.net

echo.
echo  El tunel se cerro.
pause
