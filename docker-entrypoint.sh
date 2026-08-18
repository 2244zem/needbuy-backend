#!/bin/sh
set -e

echo "==> Starting NeedBuy backend..."
echo "    NODE_ENV=$NODE_ENV"
echo "    PORT=$PORT"

echo "==> Running prisma migrate deploy..."
npx prisma migrate deploy || echo "WARN: prisma migrate deploy failed, continuing anyway"

echo "==> Starting server on port ${PORT:-8000}..."
exec node dist/server.js
