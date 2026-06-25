#!/bin/bash
set -e

echo "Installing backend dependencies..."
cd /workspace/backend
npm install

echo "Running Prisma migrations..."
npm run migrate

echo "Installing frontend dependencies..."
cd /workspace/frontend
npm install

echo "✓ Dev container ready. Use 'npm run dev' in backend/ and 'npm start' in frontend/"
