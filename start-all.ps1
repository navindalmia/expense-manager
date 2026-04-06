# Expense Manager - Start All Servers (PowerShell)
# This script opens 3 terminal windows for Backend, Frontend, and Prisma Studio

$rootPath = "c:\nd\repos\expense-manager"

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host " Expense Manager - Starting All  " -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "Starting 3 servers in new windows..." -ForegroundColor Yellow
Write-Host ""

# Start Backend (Express on port 4000)
Write-Host "[1/3] Starting Backend on port 4000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$rootPath\backend' ; npm run dev`"" -WindowStyle Normal

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start Frontend (Expo on port 19000)
Write-Host "[2/3] Starting Frontend on port 19000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$rootPath\frontend' ; npm start`"" -WindowStyle Normal

# Wait a bit for frontend to start
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host " All servers started!             " -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open your browser:" -ForegroundColor Yellow
Write-Host "  • Backend API:      http://localhost:4000" -ForegroundColor White
Write-Host "  • Expo QR Code:     Check the Expo terminal window" -ForegroundColor White
Write-Host ""
Write-Host "To scan on mobile:" -ForegroundColor Yellow
Write-Host "  • Install Expo Go app" -ForegroundColor White
Write-Host "  • Scan the QR code displayed in Frontend window" -ForegroundColor White
Write-Host ""
