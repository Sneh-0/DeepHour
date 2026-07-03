# Launches all three Deep-Work Tracker services, each in its own window.
# Usage: .\dev.ps1   (from the repo root)
$root = $PSScriptRoot

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\server'; Write-Host 'Express API - http://localhost:4000' -ForegroundColor Cyan; npm start"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\ml-service'; Write-Host 'Flask ML service - http://localhost:5001' -ForegroundColor Cyan; .\.venv\Scripts\python.exe app.py"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\client'; Write-Host 'Vite client - http://localhost:5173' -ForegroundColor Cyan; npm run dev"

Write-Host ''
Write-Host 'All three services launching in separate windows.' -ForegroundColor Green
Write-Host 'App: http://localhost:5173   (demo@demo.com / demo1234)'
