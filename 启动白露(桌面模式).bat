@echo off
chcp 65001 >nul
setlocal
set "APPDIR=%~dp0"
set "URL=file:///%APPDIR:\=/%index.html"

set "CHROME1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "CHROME3=%LocalAppData%\Google\Chrome\Application\chrome.exe"
set "EDGE1=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME1%" (
    start "" "%CHROME1%" --app="%URL%" --disable-web-security --user-data-dir="%TEMP%\bailu_app_profile"
    goto :eof
)
if exist "%CHROME2%" (
    start "" "%CHROME2%" --app="%URL%" --disable-web-security --user-data-dir="%TEMP%\bailu_app_profile"
    goto :eof
)
if exist "%CHROME3%" (
    start "" "%CHROME3%" --app="%URL%" --disable-web-security --user-data-dir="%TEMP%\bailu_app_profile"
    goto :eof
)
if exist "%EDGE1%" (
    start "" "%EDGE1%" --app="%URL%" --disable-web-security --user-data-dir="%TEMP%\bailu_app_profile"
    goto :eof
)
if exist "%EDGE2%" (
    start "" "%EDGE2%" --app="%URL%" --disable-web-security --user-data-dir="%TEMP%\bailu_app_profile"
    goto :eof
)

start "" "%URL%"
