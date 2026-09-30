@echo off
REM ---------------------------------------------------------------
REM  Keep this file PURE ASCII on purpose.
REM  cmd.exe parses .bat byte-by-byte; any multi-byte (Chinese) text
REM  can desync the read pointer and chop later commands in half
REM  (the classic "'BINARIES_MIRROR' is not recognized" symptom).
REM  All Chinese output lives in tasks.js and is printed by Node.
REM ---------------------------------------------------------------
chcp 65001 >nul
cd /d "%~dp0"
title Bailu Desktop - Build exe

where node >nul 2>nul
if errorlevel 1 goto NONODE

node tasks.js build
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
