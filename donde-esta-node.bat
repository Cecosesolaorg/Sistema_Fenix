@echo off
setlocal EnableExtensions
title Donde esta Node.js - Fenix
color 0B
cls
cd /d "%~dp0"

echo.
echo  =========================================
echo    DIAGNOSTICO DE NODE.JS - FENIX
echo  =========================================
echo.
echo  Carpeta:
echo    %CD%
echo.

echo  Archivos buscados:
call :revisar "%~dp0tools\node_portable\node.exe" "tools\node_portable\node.exe"
call :revisar "%~dp0node_portable\node.exe" "node_portable\node.exe"
call :revisar "%~dp0node.exe" "node.exe"

echo.
echo  Busqueda en PATH ^(where node^):
where node 2>nul
if errorlevel 1 echo    No encontrado en PATH.

echo.
echo  PowerShell:
where powershell 2>nul
if errorlevel 1 echo    No encontrado.

echo.
echo  PowerShell 7 ^(pwsh^):
where pwsh 2>nul
if errorlevel 1 echo    No encontrado.

echo.
echo  Cliente SSH:
where ssh 2>nul
if errorlevel 1 echo    No encontrado.

echo.
call :detectar
if defined NODE_EXE (
    echo  Node detectado:
    echo    %NODE_EXE%
    echo.
    echo  Version:
    "%NODE_EXE%" --version
    echo.
    echo  Direccion local del servidor:
    echo    http://localhost:8000
) else (
    color 0E
    echo  Node NO detectado en esta carpeta.
    echo.
    echo  Ejecuta iniciar_servidor.bat y responde S para
    echo  descargarlo, o copia tools\node_portable desde
    echo  otra PC.
)
echo.
pause
endlocal
exit /b 0

:revisar
if exist "%~1" (echo    [OK]  %~2) else (echo    [--]  %~2)
goto :eof

:detectar
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