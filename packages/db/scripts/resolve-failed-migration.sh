#!/bin/sh
# Script to resolve the failed migration and apply new ones
# Usage: Run this from the packages/db directory

set -e

echo "=== Resolving Failed Migration ==="
echo ""

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
  echo "Error: Must run from packages/db directory"
  exit 1
fi

echo "To resolve the failed migration, you need to mark it as either:"
echo "  - rolled-back (if it didn't apply)"
echo "  - applied (if it did apply but was marked as failed)"
echo ""
echo "Run one of these commands:"
echo ""
echo "  # If the migration didn't actually apply:"
echo "  pnpm prisma migrate resolve --rolled-back 20251223150000_add_unpublished_status"
echo ""
echo "  # If the migration already applied successfully:"
echo "  pnpm prisma migrate resolve --applied 20251223150000_add_unpublished_status"
echo ""
echo "After resolving, restart your containers to apply new migrations:"
echo "  docker-compose restart api"
echo ""


