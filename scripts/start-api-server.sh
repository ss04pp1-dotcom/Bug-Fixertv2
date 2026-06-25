#!/bin/bash
set -e

echo "[api-server] Starting Redis..."
redis-server --daemonize yes --logfile /tmp/redis.log --port 6379
echo "[api-server] Redis started."

export DIRECT_URL="$DATABASE_URL"

echo "[api-server] Starting NestJS..."
exec pnpm --filter @workspace/api-server run dev
