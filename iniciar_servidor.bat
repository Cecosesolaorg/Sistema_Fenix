@echo off
title Servidor Inventario Fenix
color 0A
cls
echo.
echo  =========================================
echo       SERVIDOR FENIX  -  HTTP ACTIVO
echo  =========================================
echo.

:: Matar servidores viejos
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Obtener IP automaticamente
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "192.168.137"') do (
    set RAW_IP=%%a
)
set LOCAL_IP=%RAW_IP: =%

:: Iniciar servidor usando node portable
start "Servidor Node" cmd /k ""tools\node_portable\node.exe" server.js"

:: Esperar a que el servidor inicie
timeout /t 3 /nobreak >nul

echo  Esta PC:
echo     http://localhost:8000
echo.
echo  Telefonos en esta RED:
echo     http://%LOCAL_IP%:8000
echo.
echo  =========================================
echo   COMO CONECTAR EL TELEFONO:
echo.
echo   1. Asegurate que el telefono este en
echo      el MISMO WiFi que esta PC
echo.
echo   2. Abre en el telefono:
echo      http://%LOCAL_IP%:8000
echo.
echo  =========================================
echo.

:: Abrir pagina de inicio en el navegador
start http://localhost:8000/index.html

pause
