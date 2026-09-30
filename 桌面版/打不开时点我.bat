@echo off
REM ---------------------------------------------------------------
REM  Keep this file PURE ASCII on purpose - see the build .bat header.
REM ---------------------------------------------------------------
chcp 65001 >nul
cd /d "%~dp0"
title Bailu Desktop - Diagnose

where node >nul 2>nul
if errorlevel 1 goto NONODE

node tasks.js doctor
echo.
pause
exit /b 0

:NONODE
echo.
echo  [x] Node.js not found.
echo.
echo      Please install Node.js LTS from https://nodejs.org
echo      then close this window and run this file again.
echo.
pause
exit /b 1
