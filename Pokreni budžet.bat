@echo off
rem ─────────────────────────────────────────────────────────────
rem  Budžet — lokalni pokretač.
rem  Aplikacija se MORA posluživati preko HTTP-a (ne file://).
rem  Dvoklik na ovu datoteku: pokreće lokalni server + otvara preglednik.
rem  Za zaustavljanje: zatvori ovaj crni prozor.
rem ─────────────────────────────────────────────────────────────
cd /d "%~dp0"
set PORT=8761

rem Traži stvarni python.exe izravno po poznatim instalacijskim putanjama, jer Windows
rem zna imati "python" App execution alias koji se javlja kao pronađen a zapravo ne radi.
set PYEXE=
for %%V in (Python313 Python312 Python311 Python310 Python39) do (
  if not defined PYEXE if exist "%LocalAppData%\Programs\Python\%%V\python.exe" set PYEXE=%LocalAppData%\Programs\Python\%%V\python.exe
)
if not defined PYEXE (
  where py >nul 2>nul && set PYEXE=py
)
if not defined PYEXE (
  for /f "delims=" %%P in ('where python 2^>nul') do (
    echo %%P | findstr /i "WindowsApps" >nul || if not defined PYEXE set PYEXE=%%P
  )
)

rem otvori preglednik s malim odmakom da server stigne startati
start "" cmd /c "timeout /t 1 >nul & start http://localhost:%PORT%/"

if defined PYEXE (
  "%PYEXE%" -m http.server %PORT% --bind 127.0.0.1
) else (
  echo.
  echo  Python nije pronaden. Instaliraj Python sa python.org ili "winget install Python.Python.3.13".
  pause
)
