@echo off
REM Expense Manager - Start All Servers
REM This script opens 3 terminal windows for Backend, Frontend, and Prisma Studio

setlocal enabledelayedexpansion

cd /d c:\nd\repos\expense-manager

echo.
echo ===================================
echo  Expense Manager - Starting All
echo ===================================
echo.
echo Starting 3 servers in new windows...
echo.

REM Start Backend (Express on port 4000)
echo [1/3] Starting Backend on port 4000...
start "Expense Manager - Backend" cmd /k "cd backend && npm run dev"

REM Wait a bit for backend to start
timeout /t 3 /nobreak

REM Start Frontend (Expo on port 19000)
echo [2/3] Starting Frontend on port 19000...
start "Expense Manager - Frontend" cmd /k "cd frontend && npm start"

REM Wait a bit for frontend to start
timeout /t 3 /nobreak

echo.
echo ===================================
echo  All servers started!
echo ===================================
echo.
echo Open browser:
echo  - Backend API:      http://localhost:4000
echo  - Expo:             http://localhost:19000
echo.
echo Scan QR code in Expo terminal to view app on phone.
echo.
pause
