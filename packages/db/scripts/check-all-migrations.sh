#!/bin/sh
# Check all migrations in database vs files

echo "=== All Migrations in Database ==="
echo "Run this command to see ALL migrations:"
echo ""
echo "docker-compose exec postgres psql -U postgres -d app -c \"SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;\""
echo ""
echo "=== All Migration Directories ==="
ls -la packages/db/prisma/migrations/ | grep '^d' | awk '{print $NF}' | grep -E '^[0-9]'

