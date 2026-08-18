#!/bin/sh

echo "==> Starting NeedBuy backend..."
echo "    NODE_ENV=$NODE_ENV"
echo "    PORT=${PORT:-8000}"

echo "==> Running prisma migrate deploy (timeout 30s)..."
timeout 30 npx prisma migrate deploy 2>&1 && echo "==> Migrations OK." || echo "WARN: prisma migrate deploy failed/timed out, skipping."

echo "==> Starting server on port ${PORT:-8000}..."
exec node dist/server.js
