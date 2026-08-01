@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Recipient Queue Repository Duzeltme Paket 13G-14-FIX-1
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Bu paketi proje ana klasorunde calistirin.
  pause
  exit /b 1
)

node ".package-13g-14-fix-1.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-14-FIX-1 basariyla kuruldu.
echo.
echo Duzeltilenler:
echo - Queue dosyasi 13G-14 yedeginden geri yuklendi
echo - Dort bitisik fonksiyon tek guvenli blok olarak tasindi
echo - Artakalan audience query govdesi temizlendi
echo - Repository dosyasi yeniden kuruldu
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
echo Ekran ciktisini paylasin.
pause
exit /b 1
