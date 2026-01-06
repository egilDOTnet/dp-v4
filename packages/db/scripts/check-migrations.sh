#!/bin/sh
# Script to check for missing migration files

echo "Checking for migration directories without migration.sql files..."

cd "$(dirname "$0")/../prisma/migrations"

for dir in */; do
  if [ ! -f "${dir}migration.sql" ]; then
    echo "WARNING: Missing migration.sql in: $dir"
  fi
done

echo "Migration check complete."



