@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Campaign Repository Duzeltme Paket 13G-12-FIX-2
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-12-fix-2.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-12-FIX-2 basariyla kuruldu.
pause
exit /b 0

:apply_error
echo.
echo Paket uygulanamadi.
pause
exit /b 1

:typecheck_error
echo.
echo Typecheck hata verdi.
echo Geri almak icin:
echo copy /y "src\main\ipc\register-campaign-ipc.ts.before-package-13g-12-fix-2.bak" "src\main\ipc\register-campaign-ipc.ts"
pause
exit /b 1
