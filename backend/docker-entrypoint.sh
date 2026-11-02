#!/bin/sh
set -e

echo "==> Running Prisma db push to sync schema with PostgreSQL..."
npx prisma db push --skip-generate

echo "==> Starting backend application..."
exec "$@"
