@echo off
cd /d "%~dp0"
chcp 65001 >nul
echo AI Operasyon - Campaign Recipient Processor Duzeltme Paket 13G-31-FIX-1
echo.
node ".package-13g-31-fix-1.cjs"
if errorlevel 1 goto :error
echo.
echo Typecheck baslatiliyor...
call npm run typecheck
if errorlevel 1 goto :typecheck
echo.
echo Paket 13G-31-FIX-1 basariyla kuruldu.
pause
exit /b 0
:error
echo Paket uygulanamadi.
pause
exit /b 1
:typecheck
echo Typecheck hata verdi.
pause
exit /b 1
