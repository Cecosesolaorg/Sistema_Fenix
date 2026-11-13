@echo off
setlocal EnableExtensions
title Servidor Fenix + Acceso Internet
color 0A
cls

cd /d "%~dp0"

if not defined PORT set "PORT=8000"

echo.
echo  =========================================
echo     INICIANDO SERVIDOR FENIX + INTERNET
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
    echo  Copia tools\node_portable con node.exe junto a este .bat
    echo  o instala Node.js LTS desde https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Node detectado: %NODE_EXE%
echo.

:: -- Verificar que exista el cliente SSH ------------------------------------
where ssh >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  ERROR: no se encontro el cliente SSH.
    echo.
    echo  En Windows 10/11: Configuracion ^> Aplicaciones
    echo  ^> Caracteristicas opcionales ^> Cliente OpenSSH.
    echo.
    pause
    exit /b 1
)

:: -- Cerrar una instancia anterior en el mismo puerto -----------------------
echo  [1/3] Cerrando servidores anteriores...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch { }" >nul 2>&1
timeout /t 1 /nobreak >nul

:: -- Iniciar el servidor ----------------------------------------------------
echo  [2/3] Iniciando servidor local...
start "Servidor Fenix Node" /min /d "%~dp0" cmd /k ""%NODE_EXE%" server.js"

echo  Esperando que el servidor encienda...
set "LISTO="
for /l %%i in (1,1,10) do (
    if not defined LISTO (
        powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if not errorlevel 1 set "LISTO=1"
        if not defined LISTO timeout /t 1 /nobreak >nul
    )
)

echo  [3/3] Verificando servidor...
if defined LISTO (
    echo  Servidor OK
) else (
    color 0E
    echo  ADVERTENCIA: el servidor puede no estar listo aun.
    echo  Revisa la ventana "Servidor Fenix Node".
)

echo.
echo  =========================================
echo   Creando tunel de internet...
echo   La URL publica aparecera ABAJO en verde
echo   Compartela con tu equipo.
echo.
echo   ATENCION: el tunel publica la aplicacion
echo   en Internet. Usalo solo para pruebas.
echo  =========================================
echo.

:: Crear tunel SSH
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:%PORT% serveo.net

echo.
echo  El tunel se cerro.
pause
endlocal