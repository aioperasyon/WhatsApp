@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Campaign State Repository Paket 13G-19 V3
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Bu paketi proje ana klasorunde calistirin.
  pause
  exit /b 1
)

if not exist ".package-13g-19-v3.cjs" (
  echo Paket uygulama dosyasi bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-19-v3.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-19 V3 basariyla kuruldu.
echo.
echo Tasindilar:
echo - Kampanya baslatma kilidi
echo - Kampanya tamamlama
echo - Kampanya sayac ve durum uzlastirma
echo - Kampanya durumunu tek kayit olarak okuma
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
echo copy /y "src\main\services\campaign-queue.service.ts.before-package-13g-19-v3.bak" "src\main\services\campaign-queue.service.ts"
echo del /q "src\main\repositories\campaign-state.repository.ts"
echo.
echo Ekran ciktisini paylasin.
pause
exit /b 1
