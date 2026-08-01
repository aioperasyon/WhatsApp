@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Campaign Timing Service Paket 13G-17
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Bu paketi proje ana klasorunde calistirin.
  pause
  exit /b 1
)

if not exist ".package-13g-17.cjs" (
  echo Paket uygulama dosyasi bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-17.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-17 basariyla kuruldu.
echo.
echo Tasindilar:
echo - Calisma saati parse ve dogrulama
echo - Calisma penceresine kalan sure hesabi
echo - Sonraki yerel gune kalan sure hesabi
echo - Kampanya gecikmeleri icin rastgele sayi uretimi
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
echo copy /y "src\main\services\campaign-queue.service.ts.before-package-13g-17.bak" "src\main\services\campaign-queue.service.ts"
echo del /q "src\main\services\campaign\campaign-timing.service.ts"
echo.
echo Ekran ciktisini paylasin.
pause
exit /b 1
