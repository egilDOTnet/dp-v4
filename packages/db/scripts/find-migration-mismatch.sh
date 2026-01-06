#!/bin/sh
# Script to find mismatch between database migrations and files

set -e

cd "$(dirname "$0")/.."

echo "=== Finding Migration Mismatch ==="
echo ""

echo "1. Migrations in database (_prisma_migrations table):"
echo "   Run: docker-compose exec postgres psql -U postgres -d app -c \"SELECT migration_name FROM _prisma_migrations ORDER BY started_at;\""
echo ""

echo "2. Migration files on disk:"
ls -1 prisma/migrations/ | grep -E '^[0-9]' | sort
echo ""

echo "3. Checking each migration directory for migration.sql:"
for dir in prisma/migrations/*/; do
  MIG_NAME=$(basename "$dir")
  if [ -f "${dir}migration.sql" ]; then
    echo "   ✅ $MIG_NAME - has migration.sql"
  else
    echo "   ❌ $MIG_NAME - MISSING migration.sql"
  fi
done

echo ""
echo "4. Count comparison:"
DB_COUNT=$(docker-compose exec -T postgres psql -U postgres -d app -t -c "SELECT COUNT(*) FROM _prisma_migrations WHERE rolled_back_at IS NULL;" 2>/dev/null || echo "?")
FILE_COUNT=$(find prisma/migrations -name "migration.sql" | wc -l)
echo "   Database migrations (not rolled back): $DB_COUNT"
echo "   Migration files on disk: $FILE_COUNT"



