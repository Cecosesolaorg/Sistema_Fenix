@echo off
setlocal EnableExtensions
title Servidor Fenix + Acceso Internet
color 0A
cls

:: Trabajar siempre en la carpeta de este .bat
cd /d "%~dp0"
if not defined PORT set "PORT=8000"
set "INTENTO=0"
call :detectar_ps

echo.
echo  =========================================
echo     SERVIDOR FENIX  -  HTTP + INTERNET
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

:: -- 3. Verificar cliente SSH -----------------------------------------------
:tengo_node
echo  Node: %NODE_EXE%
echo.
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

:: -- 4. Mostrar datos de la red local ---------------------------------------
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "192.168.137"') do if not defined LOCAL_IP set "LOCAL_IP=%%a"
set "LOCAL_IP=%LOCAL_IP: =%"
echo  [1/4] Esta PC:
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

:: -- 5. Arrancar el servidor en su propia ventana ---------------------------
echo  [2/4] Iniciando servidor local...
if defined PS_EXE (
    "%PS_EXE%" -NoProfile -Command "Start-Process -FilePath '%NODE_EXE%' -ArgumentList 'server.js' -WorkingDirectory '%CD%' -WindowStyle Minimized"
) else (
    start /min "Servidor Fenix Node" "%NODE_EXE%" server.js
)

echo  [3/4] Esperando que el servidor responda...
set "LISTO="
if not defined PS_EXE (
    timeout /t 5 /nobreak >nul
    set "LISTO=1"
    goto :espera_fin
)
for /l %%i in (1,1,15) do (
    if not defined LISTO (
        "%PS_EXE%" -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
        if not errorlevel 1 set "LISTO=1"
        if not defined LISTO timeout /t 1 /nobreak >nul
    )
)
:espera_fin

if defined LISTO (
    echo        Servidor OK.
) else (
    color 0E
    echo        ADVERTENCIA: el servidor aun no responde.
    echo        Revisa la ventana "Servidor Fenix Node".
    echo        Si se cerro, ejecuta a mano:
    echo           "%NODE_EXE%" server.js
)
echo.

echo  [4/4] Creando tunel de internet...
echo.
echo  =========================================
echo   La URL publica aparecera ABAJO, en verde.
echo   Compartila con tu equipo.
echo.
echo   ATENCION: el tunel publica la aplicacion
echo   en Internet. Usalo solo para pruebas.
echo   Para cortar todo: Ctrl+C o cerrar esta
echo   ventana y la ventana "Servidor Fenix Node".
echo  =========================================
echo.

ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:%PORT% serveo.net

echo.
echo  El tunel se cerro.
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
