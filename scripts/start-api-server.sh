#!/bin/bash
set -e

echo "[api-server] Starting Redis..."
if ! pgrep -x redis-server >/dev/null 2>&1; then
  redis-server --daemonize yes --logfile /tmp/redis.log --port 6379 \
    || echo "[warn] Redis not started — BullMQ jobs will fail"
else
  echo "[api-server] Redis already running."
fi

# DIRECT_URL should point to the direct (port 5432) connection for migrations.
# Falls back to DATABASE_URL (pooler) for dev only.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "[api-server] Starting NestJS..."
exec pnpm --filter @workspace/api-server run dev
