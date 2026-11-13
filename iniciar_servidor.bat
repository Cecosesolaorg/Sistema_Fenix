@echo off
setlocal EnableExtensions
title Servidor Fenix
color 0A
cls

:: Trabajar siempre en la carpeta de este .bat
cd /d "%~dp0"
if not defined PORT set "PORT=8000"
set "INTENTO=0"
call :detectar_ps

echo.
echo  =========================================
echo       SERVIDOR FENIX  -  HTTP ACTIVO
echo  =========================================
echo.

:: -- 1. Buscar Node.js ------------------------------------------------------
call :detectar_node
if defined NODE_EXE goto :validar_node

:preguntar_instalacion
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

if not defined PS_EXE (
    color 0C
    echo.
    echo  ERROR: no se encontro PowerShell ni pwsh.
    echo  Copia la carpeta tools\node_portable desde otra PC
    echo  o instala Node.js desde https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0tools\instalar-node.ps1" (
    color 0C
    echo.
    echo  ERROR: falta el archivo tools\instalar-node.ps1
    echo  Volve a copiar la carpeta tools completa del proyecto.
    echo.
    pause
    exit /b 1
)

echo.
"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\instalar-node.ps1"
if errorlevel 1 goto :sin_node
call :detectar_node
if defined NODE_EXE goto :validar_node
goto :sin_node

:: -- 2. Validar que el node.exe detectado funcione --------------------------
:validar_node
if not exist "%NODE_EXE%" goto :node_invalido
"%NODE_EXE%" -v >nul 2>&1
if errorlevel 1 goto :node_invalido
goto :tengo_node

:node_invalido
if "%INTENTO%"=="1" goto :sin_node
set "INTENTO=1"
color 0E
echo.
echo  El node.exe detectado no funciona:
echo     %NODE_EXE%
echo.
echo  Se puede instalar una version portable nueva.
set "NODE_EXE="
goto :preguntar_instalacion

:: -- 3. Mostrar datos y arrancar --------------------------------------------
:tengo_node
echo  Node: %NODE_EXE%
echo  Comando: "%NODE_EXE%" server.js
echo.

set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "192.168.137"') do if not defined LOCAL_IP set "LOCAL_IP=%%a"
set "LOCAL_IP=%LOCAL_IP: =%"

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
echo   El servidor queda corriendo en ESTA ventana.
echo   Para detenerlo: Ctrl+C o cerrar la ventana.
echo.
echo   Si el navegador no abre solo, entra a:
echo     http://localhost:%PORT%
echo  =========================================
echo.

if defined PS_EXE (
    start "" %PS_EXE% -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:%PORT%/'"
) else (
    start "" "http://localhost:%PORT%/"
)

"%NODE_EXE%" server.js

echo.
echo  El servidor se detuvo con codigo %errorlevel%.
pause
endlocal
exit /b 0

:: -- Errores ----------------------------------------------------------------
:sin_node
color 0C
echo.
echo  No se pudo iniciar Node.js.
echo.
echo  Opciones manuales:
echo    1. Copiar la carpeta tools\node_portable, con
echo       node.exe, desde una PC donde ya funcione.
echo    2. Descargar Node.js LTS desde https://nodejs.org
echo       y volver a ejecutar este .bat.
echo.
pause
exit /b 1

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

:: -- Subrutina: detectar PowerShell ------------------------------------------
:detectar_ps
set "PS_EXE="
where powershell >nul 2>&1
if not errorlevel 1 set "PS_EXE=powershell"
if not defined PS_EXE (
    where pwsh >nul 2>&1
    if not errorlevel 1 set "PS_EXE=pwsh"
)
goto :eof
