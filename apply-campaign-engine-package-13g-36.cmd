@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
echo AI Operasyon - Campaign Queue Runner Service Paket 13G-36
echo.
node ".package-13g-36.cjs"
if errorlevel 1 goto :apply_error
echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error
echo.
echo Paket 13G-36 basariyla kuruldu.
pause
exit /b 0
:apply_error
echo Paket uygulanamadi.
pause
exit /b 1
:typecheck_error
echo Typecheck hata verdi.
echo Geri almak icin:
echo copy /y "src\main\services\campaign-queue.service.ts.before-package-13g-36.bak" "src\main\services\campaign-queue.service.ts"
echo del /q "src\main\services\campaign\campaign-queue-runner.service.ts"
pause
exit /b 1
