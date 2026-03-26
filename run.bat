@echo off
REM Evalúa tu Campo - Script para ejecutar la app localmente en Windows

cd /d "%~dp0"

echo.
echo ========================================
echo   Evalúa tu Campo - Servidor Local
echo ========================================
echo.

REM Intentar con Python 3
where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Python 3 detectado
    echo Iniciando servidor en http://localhost:8000
    echo.
    echo Presionå Ctrl+C para detener el servidor
    echo.
    python3 -m http.server 8000
    pause
    exit /b 0
)

REM Intentar con Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Python detectado
    echo Iniciando servidor en http://localhost:8000
    echo.
    echo Presionå Ctrl+C para detener el servidor
    echo.
    python -m http.server 8000
    pause
    exit /b 0
)

REM Intentar con Node.js
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ Node.js detectado
    echo Iniciando servidor con http-server en http://localhost:8000
    echo.
    echo Presionå Ctrl+C para detener el servidor
    echo.
    npx http-server -p 8000
    pause
    exit /b 0
)

REM Intentar con PHP
where php >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✓ PHP detectado
    echo Iniciando servidor en http://localhost:8000
    echo.
    echo Presionå Ctrl+C para detener el servidor
    echo.
    php -S localhost:8000
    pause
    exit /b 0
)

REM Si ninguno está disponible
echo.
echo ❌ ERROR: No se encontró Python, Node.js o PHP instalado
echo.
echo SOLUCIONES:
echo 1. Instalar Python desde https://www.python.org/downloads/
echo    (IMPORTANTE: Marcar "Add Python to PATH")
echo.
echo 2. O instalar Node.js desde https://nodejs.org/
echo.
echo 3. O instalar PHP desde https://www.php.net/downloads.php
echo.
echo Después de instalar, ejecutå este archivo nuevamente.
echo.
pause
