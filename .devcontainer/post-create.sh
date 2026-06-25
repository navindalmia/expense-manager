#!/usr/bin/env bash
set -e

git config --global --add safe.directory /workspace/expense-manager
git config core.autocrlf false

echo "Installing backend dependencies..."
cd /workspace/expense-manager/backend
npm install

echo "Running Prisma migrations..."
npm run migrate

echo "Installing frontend dependencies..."
cd /workspace/expense-manager/frontend
npm install --legacy-peer-deps

echo "✓ Dev container ready. Use 'npm run dev' in backend/ and 'npm start' in frontend/"
