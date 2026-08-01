@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul

echo AI Operasyon - Campaign Repository Paket 13G-12
echo.

if not exist "package.json" (
  echo package.json bulunamadi.
  echo Paketi proje ana klasorune cikarin.
  pause
  exit /b 1
)

node ".package-13g-12.cjs"
if errorlevel 1 goto :apply_error

if not exist "src\main\repositories" mkdir "src\main\repositories"
copy /y "files\src\main\repositories\campaign.repository.ts" "src\main\repositories\campaign.repository.ts" >nul
if errorlevel 1 goto :copy_error

echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck_error

echo.
echo Paket 13G-12 basariyla kuruldu.
echo - Campaign repository olusturuldu
echo - Listeleme, kaydetme, okuma ve silme IPC katmanindan ayrildi
echo.
pause
exit /b 0

:apply_error
echo Paket uygulanamadi. Ekran ciktisini paylasin.
pause
exit /b 1

:copy_error
echo Repository dosyasi kopyalanamadi.
pause
exit /b 1

:typecheck_error
echo Typecheck hata verdi.
echo Geri almak icin:
echo copy /y "src\main\ipc\register-campaign-ipc.ts.before-package-13g-12.bak" "src\main\ipc\register-campaign-ipc.ts"
echo del /q "src\main\repositories\campaign.repository.ts"
pause
exit /b 1
