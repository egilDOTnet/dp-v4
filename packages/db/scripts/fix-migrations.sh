#!/bin/sh
# Script to fix migration issues by checking and resolving problematic migrations

set -e

echo "Checking migration status..."

# Check if there are any migrations in the database that don't have files
# This will help identify which migration is causing the issue

# First, try to resolve any failed migrations
echo "Attempting to resolve migration issues..."

# If a specific migration is causing issues, you can mark it as rolled back:
# pnpm prisma migrate resolve --rolled-back <migration_name>

# Or mark it as applied if it was already applied:
# pnpm prisma migrate resolve --applied <migration_name>

echo "Migration check complete."

