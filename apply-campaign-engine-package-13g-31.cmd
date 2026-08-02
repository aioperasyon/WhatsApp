@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Campaign Recipient Processor Service Paket 13G-31
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-31.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-31 basariyla kuruldu.
echo.
echo GitHub'a sadece:
echo - src\main\services\campaign-queue.service.ts
echo - src\main\services\campaign\campaign-runtime-state.service.ts
echo - src\main\services\campaign\campaign-recipient-processor.service.ts
echo.
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
echo Geri almak icin:
echo copy /y "src\main\services\campaign-queue.service.ts.before-package-13g-31.bak" "src\main\services\campaign-queue.service.ts"
echo del /q "src\main\services\campaign\campaign-recipient-processor.service.ts"
pause
exit /b 1
