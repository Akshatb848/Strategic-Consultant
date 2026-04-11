#!/bin/bash
# ASIS v4.0 — Quick Start Script

set -e

echo "=============================================="
echo "ASIS v4.0 — Autonomous Strategic Intelligence"
echo "=============================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is required. Install from https://nodejs.org"
    exit 1
fi

echo ""
echo "[1/4] Installing backend dependencies..."
cd "$(dirname "$0")/asis/backend"
npm install

echo ""
echo "[2/4] Installing frontend dependencies..."
cd "$(dirname "$0")/asis/frontend"
npm install

echo ""
echo "[3/4] Backend environment:"
echo "   Copy asis/backend/.env.example to asis/backend/.env"
echo "   Set ANTHROPIC_API_KEY and DATABASE_URL"
echo ""
echo "   Database setup:"
echo "   1. Create PostgreSQL database: CREATE DATABASE asis_v4;"
echo "   2. Run: cd asis/backend && npx prisma migrate dev --name asis_v4_foundation"
echo "   3. Run: npx prisma generate"
echo ""
echo "   Then start backend: cd asis/backend && npm run dev"
echo "   Backend runs on: http://localhost:8000"
echo ""
echo "   Then start frontend: cd asis/frontend && npm run dev"
echo "   Frontend runs on: http://localhost:3001"
echo ""
echo "=============================================="
echo "Ready to go!"
echo "=============================================="
