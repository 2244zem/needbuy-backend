#!/bin/sh

echo "==> Starting NeedBuy backend..."
echo "    NODE_ENV=$NODE_ENV"
echo "    PORT=${PORT:-8000}"

# Run migration in background - don't block server start
echo "==> Running prisma migrate deploy in background..."
nohup sh -c 'npx prisma migrate deploy 2>&1 && echo "==> Migrations OK" || echo "WARN: prisma migrate deploy failed"' &

echo "==> Starting server on port ${PORT:-8000}..."
exec node dist/server.js
