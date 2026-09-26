@echo off
cd /d "%~dp0"
title AI Hub Build

echo ============================================
echo   AI Hub Installer Build
echo ============================================
echo.
echo Building, please wait...
echo.

REM Use China mirrors so electron-builder can download NSIS without GitHub
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_CUSTOM_DIR={{ version }}

call npm run build:installer
if errorlevel 1 goto fail

echo.
if exist "dist\AI-Hub-Setup-1.5.0.exe" goto success
goto fail

:success
echo ============================================
echo   Build OK!
echo   Output: dist\AI-Hub-Setup-1.5.0.exe
echo ============================================
goto end

:fail
echo ============================================
echo   Build may have failed, check logs above
echo ============================================

:end
echo.
pause
