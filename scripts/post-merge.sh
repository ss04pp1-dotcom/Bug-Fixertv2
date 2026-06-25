#!/bin/bash
set -e

# Install all workspace dependencies (restores symlinks and node_modules)
pnpm install --no-frozen-lockfile

# Regenerate Prisma client after schema/dependency changes
cd artifacts/api-server
npx prisma generate || true
cd /home/runner/workspace

echo "post-merge setup complete"
