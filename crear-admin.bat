@echo off
setlocal EnableExtensions
title Crear administrador - Sistema Fenix
color 0B
cls
cd /d "%~dp0"

echo.
echo  =========================================
echo    CREAR ADMINISTRADOR - SISTEMA FENIX
echo  =========================================
echo.

call :detectar_node
if not defined NODE_EXE (
    color 0C
    echo  No se encontro Node.js.
    echo.
    echo  Ejecuta iniciar_servidor.bat una vez y responde S
    echo  para instalarlo, o copia tools\node_portable.
    echo.
    pause
    exit /b 1
)

"%NODE_EXE%" "%~dp0tools\crear-admin.js" %*
echo.
pause
endlocal
exit /b 0

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