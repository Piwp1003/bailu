@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 上传白露到 GitHub

where git >/dev/null 2>nul
if errorlevel 1 (
  echo 还没装 Git。先去 https://git-scm.com/download/win 下载安装（一路下一步），装完再双击我。
  pause
  exit /b
)

if not exist ".git" git init -b main
git config user.name >/dev/null 2>/dev/null || git config user.name "bailu"
git config user.email >/dev/null 2>/dev/null || git config user.email "bailu@users.noreply.github.com"

git remote get-url origin >/dev/null 2>/dev/null && goto push
echo 1. 先在 GitHub 网页右上角 + ^> New repository，起个名字（比如 bailu），不要勾 README，建好。
echo 2. 把仓库地址复制过来，像这样：https://github.com/你的用户名/bailu.git
echo.
set /p URL=粘贴仓库地址后回车： 
if "%URL%"=="" ( echo 没填地址 & pause & exit /b )
git remote add origin %URL%

:push
git add -A
git commit -m "白露 更新"
git branch -M main
echo.
echo 第一次上传会弹出 GitHub 登录，在浏览器里登录授权就好。
set TRY=0
:again
set /a TRY+=1
git push -u origin main
if not errorlevel 1 goto ok
echo 网上仓库里可能已经有东西了，先合到一起（以你电脑上的为准）……
git pull origin main --allow-unrelated-histories --no-rebase --no-edit -X ours
git push -u origin main
if not errorlevel 1 goto ok
if %TRY% LSS 3 ( echo 连 GitHub 断了，等 3 秒再试第 %TRY% 次…… & timeout /t 3 >nul & goto again )
echo.
echo 还是连不上 GitHub（国内网络经常这样）。
echo 如果你开着加速器 / 梯子，输入它的端口号：Clash 一般是 7890，v2rayN 一般是 10809。
set /p PORT=端口号（没开就直接回车）： 
if "%PORT%"=="" goto fail
git config http.proxy http://127.0.0.1:%PORT%
git config https.proxy http://127.0.0.1:%PORT%
set TRY=0
set PORT=
goto again
:fail
echo 上传没成功，把上面的红字/英文截图给我看看。
pause
exit /b
:ok
echo.
echo 上传好啦！以后改了东西再双击我一次就同步上去。
pause
