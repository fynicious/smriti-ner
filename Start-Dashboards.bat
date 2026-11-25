@echo off
echo ====================================================
echo Starting NER Cognitive App (Final Build)
echo ====================================================
echo.

:: Start the Next.js development server in a separate window
echo [1/2] Launching the local server...
start "NER Cognitive App Server" cmd /c "npm.cmd run dev"

:: Give the server a few seconds to spin up
echo [2/2] Waiting for the server to initialize...
timeout /t 6 /nobreak > NUL

:: Open the three dashboards in the default browser
echo Opening dashboards in your browser...
start http://localhost:3000/
start http://localhost:3000/caregiver
start http://localhost:3000/doctor

echo.
echo All dashboards have been launched!
echo Keep the black server window open while using the app.
echo You can close this script window now.
pause
