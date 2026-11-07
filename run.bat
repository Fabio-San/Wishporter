@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Paimon.moe Wish Converter

rem ---------------------------------------------------------------------------
rem  Find a suitable Python (3.9+). Prefer the Windows py launcher.
rem ---------------------------------------------------------------------------
set "PYTHON="
where python >nul 2>nul
if not errorlevel 1 (
    python -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON=python"
)
if not defined PYTHON (
    where py >nul 2>nul
    if not errorlevel 1 (
        py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)" >nul 2>nul
        if not errorlevel 1 set "PYTHON=py -3"
    )
)

if not defined PYTHON goto :no_python

%PYTHON% "run.py" %*
set "RC=%ERRORLEVEL%"

rem Keep the window open when the file was launched with a double click.
if "%~1"=="" pause
exit /b %RC%

rem ---------------------------------------------------------------------------
rem  Python is missing or too old.
rem ---------------------------------------------------------------------------
:no_python
echo.
echo   Python 3.9 or newer is required, but it was not found.
echo   Serve Python 3.9 o superiore, ma non e' stato trovato.
echo.
echo   Python is the engine that runs this converter. It is free and open source.
echo   Python e' il motore che esegue il convertitore. E' gratuito e open source.
echo.

where winget >nul 2>nul
if errorlevel 1 goto :download

set "ANSWER="
set /p "ANSWER=Install Python automatically with winget? [y/N] / Installare Python automaticamente con winget? [s/N]: "
if /i "%ANSWER%"=="y" goto :winget_install
if /i "%ANSWER%"=="s" goto :winget_install
goto :download

:winget_install
echo.
echo   Installing Python 3.13 (user scope)...
echo   Installazione di Python 3.13 (solo per l'utente)...
echo.
winget install --id Python.Python.3.13 -e --scope user --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo.
    echo   Automatic installation failed. Please install Python manually.
    echo   Installazione automatica non riuscita. Installa Python manualmente.
    goto :download
)

echo.
echo   Python installed. Close this window and run run.bat again.
echo   Python installato. Chiudi questa finestra e avvia di nuovo run.bat.
echo.
pause
exit /b 0

:download
echo   Download: https://www.python.org/downloads/
echo   During setup, tick "Add python.exe to PATH".
echo   Durante l'installazione, seleziona "Add python.exe to PATH".
echo.
start "" "https://www.python.org/downloads/"
pause
exit /b 1
