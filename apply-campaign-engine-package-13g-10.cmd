@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Graceful Shutdown ve Restart Recovery Paket 13G-10
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Bu paketi proje ana klasorune kopyalayip orada calistirin.
  pause
  exit /b 1
)

if not exist ".package-13g-10.cjs" (
  echo Paket uygulama dosyasi bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-10.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-10 basariyla kuruldu.
echo.
echo Eklenenler:
echo - Electron before-quit icin gercek asenkron kapanis
echo - Kampanya scheduler kapanis kilidi
echo - Yeni kampanya baslatma shutdown korumasi
echo - Runtime workerlarin kontrollu durdurulmasi
echo - Sending alicilarin yeniden pending durumuna alinmasi
echo - Running kampanyalarin paused olarak saklanmasi
echo - WhatsApp baglantilari kapanmadan veritabaninin kapatilmamasi
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
echo copy /y "src\main\main.ts.before-package-13g-10.bak" "src\main\main.ts"
echo copy /y "src\main\services\campaign-queue.service.ts.before-package-13g-10.bak" "src\main\services\campaign-queue.service.ts"
echo.
echo Ekran ciktisini paylasin.
pause
exit /b 1
