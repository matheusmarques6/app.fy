#!/usr/bin/env bash
set -e

echo "=== AppFy Development Setup ==="
echo ""

# 1. Check required tools
echo "[1/5] Checking required tools..."

command -v node >/dev/null 2>&1 || { echo "ERROR: node is not installed. Install Node.js >= 20."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm is not installed. Run: npm i -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is not installed. Install Docker Desktop."; exit 1; }

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "ERROR: Node.js >= 20 required. Current: $(node -v)"
  exit 1
fi

echo "  node $(node -v) OK"
echo "  pnpm $(pnpm -v) OK"
echo "  docker $(docker --version | cut -d' ' -f3 | tr -d ',') OK"

# 2. Copy .env.example to .env if .env doesn't exist
echo ""
echo "[2/5] Setting up environment variables..."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example"
  echo "  NOTE: Update .env with your actual credentials before running the API."
else
  echo "  .env already exists, skipping."
fi

# 3. Install dependencies
echo ""
echo "[3/5] Installing dependencies..."
pnpm install

# 4. Start docker-compose services
echo ""
echo "[4/5] Starting Docker services (PostgreSQL + Redis)..."
docker compose up -d

echo "  Waiting for services to be healthy..."
sleep 5

# 5. Generate Drizzle client and push schema
echo ""
echo "[5/5] Setting up database..."
pnpm db:generate
pnpm db:push

echo ""
echo "======================================="
echo "  AppFy setup complete!"
echo ""
echo "  Run 'pnpm dev' to start all services."
echo "  API: http://localhost:3000"
echo "  Console: http://localhost:3100"
echo "======================================="
