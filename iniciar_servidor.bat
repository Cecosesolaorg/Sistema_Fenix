@echo off
setlocal EnableExtensions
title Servidor Inventario Fenix
color 0A
cls

:: Trabajar siempre en la carpeta de este .bat, sin importar desde donde se abra
cd /d "%~dp0"

if not defined PORT set "PORT=8000"

echo.
echo  =========================================
echo       SERVIDOR FENIX  -  HTTP ACTIVO
echo  =========================================
echo.

:: -- Buscar Node.js ---------------------------------------------------------
set "NODE_EXE="
if exist "%~dp0tools\node_portable\node.exe" set "NODE_EXE=%~dp0tools\node_portable\node.exe"
if not defined NODE_EXE if exist "%~dp0node_portable\node.exe" set "NODE_EXE=%~dp0node_portable\node.exe"
if not defined NODE_EXE if exist "%~dp0node.exe" set "NODE_EXE=%~dp0node.exe"
if not defined NODE_EXE (
    for /r "%~dp0tools" %%f in (node.exe) do if not defined NODE_EXE set "NODE_EXE=%%f"
)
if not defined NODE_EXE (
    for /f "delims=" %%n in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%n"
)

if not defined NODE_EXE (
    color 0C
    echo  ERROR: no se encontro Node.js.
    echo.
    echo  Se busco en:
    echo    %~dp0tools\node_portable\node.exe
    echo    %~dp0node_portable\node.exe
    echo    %~dp0node.exe
    echo    Cualquier node.exe dentro de tools
    echo    El PATH de Windows (where node)
    echo.
    echo  Opciones:
    echo    1^) Copiar la carpeta tools\node_portable con node.exe
    echo       al lado de este archivo.
    echo    2^) Instalar Node.js LTS desde https://nodejs.org
    echo       y volver a ejecutar este .bat.
    echo.
    pause
    exit /b 1
)

echo  Node: %NODE_EXE%
echo.

:: -- Cerrar una instancia anterior en el mismo puerto -----------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch { }" >nul 2>&1
timeout /t 1 /nobreak >nul

:: -- Iniciar el servidor en su propia ventana -------------------------------
start "Servidor Node" /d "%~dp0" cmd /k ""%NODE_EXE%" server.js"

:: -- Esperar y verificar que responda ---------------------------------------
echo  Esperando al servidor...
set "LISTO="
for /l %%i in (1,1,10) do (
    if not defined LISTO (
        powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if not errorlevel 1 set "LISTO=1"
        if not defined LISTO timeout /t 1 /nobreak >nul
    )
)

:: -- Obtener IP de la red local ---------------------------------------------
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "192.168.137"') do if not defined LOCAL_IP set "LOCAL_IP=%%a"
set "LOCAL_IP=%LOCAL_IP: =%"

echo.
if defined LISTO (
    echo  Servidor activo.
) else (
    color 0E
    echo  ADVERTENCIA: el servidor aun no responde.
    echo  Revisa la ventana "Servidor Node" para ver el error.
)
echo.
echo  Esta PC:
echo     http://localhost:%PORT%
echo.
echo  Telefonos en esta RED:
if defined LOCAL_IP (
    echo     http://%LOCAL_IP%:%PORT%
) else (
    echo     No se pudo detectar la IP automaticamente.
    echo     Ejecuta ipconfig y usa la IPv4 de tu WiFi.
)
echo.
echo  =========================================
echo   COMO CONECTAR EL TELEFONO:
echo.
echo   1. El telefono debe estar en el MISMO
echo      WiFi que esta PC.
echo.
echo   2. Abre en el telefono la direccion de
echo      arriba.
echo.
echo   3. Si no carga, permite Node.js en el
echo      Firewall de Windows para redes
echo      privadas.
echo.
echo  =========================================
echo.

if defined LISTO start "" "http://localhost:%PORT%/index.html"

pause
endlocal