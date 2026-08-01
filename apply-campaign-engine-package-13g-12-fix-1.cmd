@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Campaign Repository Duzeltme Paket 13G-12-FIX-1
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Bu paketi proje ana klasorunde calistirin.
  pause
  exit /b 1
)

node ".package-13g-12-fix-1.cjs"
if errorlevel 1 goto :apply_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-12-FIX-1 basariyla kuruldu.
echo.
echo Duzeltilenler:
echo - Bozuk IPC dosyasi 13G-12 yedeginden geri yuklendi
echo - Fonksiyon bloklari guvenli markerlarla yeniden tasindi
echo - Campaign repository dosyasi yeniden kuruldu
echo - Artan virgul ve fonksiyon imzasi parcalari temizlendi
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
