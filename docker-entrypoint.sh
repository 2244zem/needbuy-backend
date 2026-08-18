#!/bin/sh

echo "==> Starting NeedBuy backend..."
echo "    NODE_ENV=$NODE_ENV"
echo "    PORT=${PORT:-8000}"

echo "==> Running prisma migrate deploy..."
if npx prisma migrate deploy 2>&1; then
  echo "==> Migrations applied successfully."
else
  echo "WARN: prisma migrate deploy failed. Falling back to prisma db push..."
  if npx prisma db push --accept-data-loss 2>&1; then
    echo "==> prisma db push succeeded."
  else
    echo "ERROR: prisma db push also failed. Starting server anyway..."
  fi
fi

echo "==> Starting server on port ${PORT:-8000}..."
exec node dist/server.js
