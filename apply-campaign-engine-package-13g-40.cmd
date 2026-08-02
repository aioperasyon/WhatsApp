@echo off
cd /d "%~dp0"
chcp 65001 >nul
echo AI Operasyon - Campaign Lifecycle Service Paket 13G-40
node ".package-13g-40.cjs" || goto :error
call npm run typecheck || goto :typecheck
echo Paket 13G-40 basariyla kuruldu.
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
