@echo off
rem ─────────────────────────────────────────────────────────────
rem  Budžet — lokalni pokretač.
rem  Aplikacija se MORA posluživati preko HTTP-a (ne file://).
rem  Dvoklik na ovu datoteku: pokreće lokalni server + otvara preglednik.
rem  Za zaustavljanje: zatvori ovaj crni prozor.
rem ─────────────────────────────────────────────────────────────
cd /d "%~dp0"
set PORT=8753

rem otvori preglednik s malim odmakom da server stigne startati
start "" cmd /c "timeout /t 1 >nul & start http://localhost:%PORT%/"

where python >nul 2>nul && (
  python -m http.server %PORT% --bind 127.0.0.1
) || (
  where py >nul 2>nul && (
    py -m http.server %PORT% --bind 127.0.0.1
  ) || (
    echo.
    echo  Python nije pronaden. Instaliraj Python ili pokreni server rucno.
    pause
  )
)
