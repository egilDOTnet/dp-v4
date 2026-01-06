#!/bin/bash
# Docker initialization script to create test database
# This runs automatically when the postgres container starts for the first time

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create test database if it doesn't exist
    SELECT 'CREATE DATABASE app_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app_test')\gexec
EOSQL

echo "✅ Test database 'app_test' created (or already exists)"


