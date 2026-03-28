@echo off
setlocal
cd /d "%~dp0"
title Absolute Terminal Hub
cls

echo ============================================
echo      ABSOLUTE HUB - TERMINAL MANAGER
echo ============================================
echo Iniciando Hub de texto unificado...

node AbsoluteHub.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El Hub se detuvo. Por favor, revisa mas arriba.
    pause
)




