@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Campaign Queue Gate Service Paket 13G-34
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-34.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-34 basariyla kuruldu.
pause
exit /b 0

:apply_error
echo.
echo Paket uygulanamadi.
echo Ekran ciktisini paylasin.
pause
exit /b 1

:typecheck_error
echo.
echo Typecheck hata verdi.
echo.
echo Geri almak icin:
echo copy /y "src\main\services\campaign-queue.service.ts.before-package-13g-34.bak" "src\main\services\campaign-queue.service.ts"
echo del /q "src\main\services\campaign\campaign-queue-gate.service.ts"
echo.
pause
exit /b 1
