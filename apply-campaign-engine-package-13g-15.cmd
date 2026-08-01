@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Recipient Lifecycle Repository Paket 13G-15
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Bu paketi proje ana klasorunde calistirin.
  pause
  exit /b 1
)

if not exist ".package-13g-15.cjs" (
  echo Paket uygulama dosyasi bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-15.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-15 basariyla kuruldu.
echo.
echo Tasindilar:
echo - Siradaki pending aliciyi okuma
echo - Aliciyi atomik olarak sending durumuna alma
echo - Sent, failed ve pending durum guncellemeleri
echo - Bekleyen alici sayisini hesaplama
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
echo.
echo Geri almak icin:
echo copy /y "src\main\services\campaign-queue.service.ts.before-package-13g-15.bak" "src\main\services\campaign-queue.service.ts"
echo del /q "src\main\repositories\campaign-recipient-lifecycle.repository.ts"
echo.
echo Ekran ciktisini paylasin.
pause
exit /b 1
