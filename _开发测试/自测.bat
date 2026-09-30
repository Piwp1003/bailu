@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 谷雨自测：用无头浏览器把整个 app 跑一遍，不联网、不动你的存档。
echo.
if not exist node_modules\playwright (
  echo 第一次用：先装一下测试工具（只装一次，要联网）...
  call npm i playwright --no-save --no-audit --no-fund
  echo.
)
node _开发测试\run-all.mjs
echo.
echo 结果也存在 _开发测试\自测结果.txt 里。
pause
