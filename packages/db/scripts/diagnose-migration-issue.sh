#!/bin/sh
# Script to diagnose and fix Prisma migration P3015 error

set -e

cd "$(dirname "$0")/.."

echo "=== Diagnosing Migration Issue ==="
echo ""

echo "1. Checking migration directories..."
MIG_DIRS=$(find prisma/migrations -type d -mindepth 1 -maxdepth 1 | wc -l)
echo "   Found $MIG_DIRS migration directories"

echo ""
echo "2. Checking for missing migration.sql files..."
MISSING=0
for dir in prisma/migrations/*/; do
  if [ ! -f "${dir}migration.sql" ]; then
    MIG_NAME=$(basename "$dir")
    echo "   ❌ Missing: $MIG_NAME"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -eq 0 ]; then
  echo "   ✅ All migration directories have migration.sql files"
else
  echo "   ⚠️  Found $MISSING migration directories without migration.sql"
fi

echo ""
echo "3. To fix this issue:"
echo "   a) If a migration is recorded in the database but file is missing:"
echo "      pnpm prisma migrate resolve --rolled-back <migration_name>"
echo ""
echo "   b) If you need to check which migrations are in the database:"
echo "      Connect to postgres and run: SELECT migration_name FROM _prisma_migrations;"
echo ""
echo "   c) To recreate the missing migration:"
echo "      pnpm prisma migrate dev --name <migration_name> --create-only"


