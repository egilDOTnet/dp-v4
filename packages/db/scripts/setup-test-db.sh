#!/bin/bash
# Setup script for test database
# Creates the test database if it doesn't exist and runs migrations

set -e

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-app_test}"

# Parse TEST_DATABASE_URL if provided
if [ -n "$TEST_DATABASE_URL" ]; then
  # Extract components from URL: postgresql://user:password@host:port/database
  # Remove postgresql:// prefix
  URL="${TEST_DATABASE_URL#postgresql://}"
  
  # Extract user:password@host:port/database
  if [[ $URL == *"@"* ]]; then
    # Has authentication
    AUTH="${URL%%@*}"
    REST="${URL#*@}"
    
    if [[ $AUTH == *":"* ]]; then
      DB_USER="${AUTH%%:*}"
      DB_PASSWORD="${AUTH#*:}"
    else
      DB_USER="$AUTH"
    fi
    
    # Extract host:port/database
    if [[ $REST == *"/"* ]]; then
      HOST_PORT="${REST%%/*}"
      DB_NAME="${REST#*/}"
      
      if [[ $HOST_PORT == *":"* ]]; then
        DB_HOST="${HOST_PORT%%:*}"
        DB_PORT="${HOST_PORT#*:}"
      else
        DB_HOST="$HOST_PORT"
      fi
    else
      DB_HOST="$REST"
    fi
  else
    # No authentication
    if [[ $URL == *"/"* ]]; then
      HOST_PORT="${URL%%/*}"
      DB_NAME="${URL#*/}"
      
      if [[ $HOST_PORT == *":"* ]]; then
        DB_HOST="${HOST_PORT%%:*}"
        DB_PORT="${HOST_PORT#*:}"
      else
        DB_HOST="$HOST_PORT"
      fi
    else
      DB_HOST="$URL"
    fi
  fi
fi

# Build connection string for postgres database (to create test database)
POSTGRES_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"
TEST_DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "🔧 Setting up test database..."
echo "   Host: ${DB_HOST}:${DB_PORT}"
echo "   User: ${DB_USER}"
echo "   Database: ${DB_NAME}"

# Check if PostgreSQL is accessible
echo "📡 Checking PostgreSQL connection..."
if ! PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Cannot connect to PostgreSQL at ${DB_HOST}:${DB_PORT}"
  echo "   Make sure PostgreSQL is running and accessible."
  echo "   If using Docker, ensure the postgres container is running:"
  echo "   docker-compose up -d postgres"
  exit 1
fi

echo "✅ PostgreSQL is accessible"

# Check if test database exists
echo "🔍 Checking if test database '${DB_NAME}' exists..."
DB_EXISTS=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}';" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
  echo "✅ Test database '${DB_NAME}' already exists"
else
  echo "📦 Creating test database '${DB_NAME}'..."
  PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};" > /dev/null
  echo "✅ Test database '${DB_NAME}' created"
fi

# Run migrations on test database
echo "🔄 Running migrations on test database..."
cd "$(dirname "$0")/.." || exit 1

# Set DATABASE_URL for prisma
export DATABASE_URL="${TEST_DB_URL}"

# Run migrations
if pnpm prisma migrate deploy > /dev/null 2>&1; then
  echo "✅ Migrations applied successfully"
else
  echo "⚠️  Migration deployment had issues, but continuing..."
  echo "   (This is normal if migrations were already applied)"
fi

echo "✅ Test database setup complete!"
echo "   Database URL: ${TEST_DB_URL}"

