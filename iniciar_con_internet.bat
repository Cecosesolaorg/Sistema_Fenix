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

set "PS_EXE="
where powershell >nul 2>&1
if not errorlevel 1 set "PS_EXE=powershell"
if not defined PS_EXE (
    where pwsh >nul 2>&1
    if not errorlevel 1 set "PS_EXE=pwsh"
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
echo  Node detectado: %NODE_EXE%
echo.

:: -- 2. Verificar cliente SSH -----------------------------------------------
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

:: -- 3. Cerrar una instancia anterior en el mismo puerto --------------------
echo  [1/3] Cerrando servidores anteriores...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch { }" >nul 2>&1
timeout /t 1 /nobreak >nul

:: -- 4. Iniciar el servidor -------------------------------------------------
echo  [2/3] Iniciando servidor local...
start "Servidor Fenix Node" /min /d "%~dp0" cmd /k ""%NODE_EXE%" server.js"

echo  Esperando que el servidor encienda...
set "LISTO="
for /l %%i in (1,1,15) do (
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