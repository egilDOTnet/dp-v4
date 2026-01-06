#!/bin/sh
# Script to fix missing migration file issue
# This checks the database for migrations that don't have corresponding files

set -e

cd "$(dirname "$0")/.."

echo "=== Fixing Missing Migration Issue ==="
echo ""

# Check database for migrations
echo "Checking database for recorded migrations..."
echo "Run this query in your database to see which migrations are recorded:"
echo ""
echo "  SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;"
echo ""
echo "If you see a migration that doesn't have a file, mark it as rolled back:"
echo ""
echo "  pnpm prisma migrate resolve --rolled-back <migration_name>"
echo ""
echo "Or if the migration was already applied but file is missing, mark it as applied:"
echo ""
echo "  pnpm prisma migrate resolve --applied <migration_name>"
echo ""

# List all migration directories
echo "Current migration directories:"
ls -1 prisma/migrations/ | grep -E '^[0-9]' | sort



