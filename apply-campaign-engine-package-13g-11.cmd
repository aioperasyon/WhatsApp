@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Kampanya Semasi Merkezi Migration Paket 13G-11
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Bu paketi proje ana klasorune kopyalayip orada calistirin.
  pause
  exit /b 1
)

if not exist ".package-13g-11.cjs" (
  echo Paket uygulama dosyasi bulunamadi.
  pause
  exit /b 1
)

node ".package-13g-11.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-11 basariyla kuruldu.
echo.
echo Eklenenler:
echo - Kampanya tablolari merkezi migration sistemine tasindi
echo - Veritabani schema surumu 2 yapildi
echo - IPC katmanindan schema olusturma sorumlulugu kaldirildi
echo - Mevcut veritabanlari icin eksik kampanya kolonlari korunarak ekleniyor
echo - Kampanya recovery islemi schema migration sonrasinda calisiyor
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
echo copy /y "src\main\ipc\register-campaign-ipc.ts.before-package-13g-11.bak" "src\main\ipc\register-campaign-ipc.ts"
echo copy /y "src\main\database\migrations\run-migrations.ts.before-package-13g-11.bak" "src\main\database\migrations\run-migrations.ts"
echo del /q "src\main\database\schema\campaign-schema.ts"
echo.
echo Ekran ciktisini paylasin.
pause
exit /b 1
