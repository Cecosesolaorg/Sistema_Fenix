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

:: -- 1. Buscar Node.js ------------------------------------------------------
call :detectar_node
if defined NODE_EXE goto :tengo_node

echo  No se encontro Node.js en esta PC.
echo.
echo  Se puede descargar la version portable oficial
echo  LTS y dejarla dentro de esta carpeta, sin
echo  permisos de administrador y sin tocar Windows.
echo.
if exist "%~dp0tools\node_portable.zip" (
    echo  Tambien se puede usar el ZIP local que este
    echo  en tools\node_portable.zip.
    echo.
)
set "RESPUESTA="
set /p "RESPUESTA=  Descargar e instalar Node.js ahora? [S/N] "
if /i "%RESPUESTA%"=="N" goto :sin_node
if /i not "%RESPUESTA%"=="S" (
    echo.
    echo  Respuesta no valida: se cancela la instalacion.
    goto :sin_node
)

where powershell >nul 2>&1
if errorlevel 1 (
    color 0C
    echo.
    echo  ERROR: no se encontro PowerShell en esta PC.
    echo  Copia la carpeta tools\node_portable desde otra PC
    echo  o instala Node.js desde https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\instalar-node.ps1"
if errorlevel 1 goto :sin_node
call :detectar_node
if defined NODE_EXE goto :tengo_node

:sin_node
color 0C
echo.
echo  No se pudo instalar Node.js automaticamente.
echo.
echo  Opciones manuales:
echo    1. Copiar la carpeta tools\node_portable, con
echo       node.exe, desde una PC donde ya funcione.
echo    2. Descargar Node.js LTS desde https://nodejs.org
echo       y volver a ejecutar este .bat.
echo.
pause
exit /b 1

:tengo_node
echo  Node: %NODE_EXE%
echo.

:: -- 2. Cerrar una instancia anterior en el mismo puerto --------------------
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch { }" >nul 2>&1
timeout /t 1 /nobreak >nul

:: -- 3. Iniciar el servidor en su propia ventana ----------------------------
start "Servidor Node" /d "%~dp0" cmd /k ""%NODE_EXE%" server.js"

:: -- 4. Esperar y verificar que responda ------------------------------------
echo  Esperando al servidor...
set "LISTO="
for /l %%i in (1,1,15) do (
    if not defined LISTO (
        powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if not errorlevel 1 set "LISTO=1"
        if not defined LISTO timeout /t 1 /nobreak >nul
    )
)

:: -- 5. Obtener IP de la red local ------------------------------------------
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
exit /b 0

:: -- Subrutina: buscar Node.js ----------------------------------------------
:detectar_node
set "NODE_EXE="
if exist "%~dp0tools\node_portable\node.exe" set "NODE_EXE=%~dp0tools\node_portable\node.exe"
if not defined NODE_EXE if exist "%~dp0node_portable\node.exe" set "NODE_EXE=%~dp0node_portable\node.exe"
if not defined NODE_EXE if exist "%~dp0node.exe" set "NODE_EXE=%~dp0node.exe"
if not defined NODE_EXE if exist "%~dp0tools" (
    for /r "%~dp0tools" %%f in (node.exe) do if not defined NODE_EXE set "NODE_EXE=%%f"
)
if not defined NODE_EXE (
    for /f "delims=" %%n in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%n"
)
goto :eof