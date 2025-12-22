# Migration Debugging Steps

## Step 1: Check ALL migrations in database (not just last 5)

Run this to see ALL migrations:

```bash
docker-compose exec postgres psql -U postgres -d app -c "SELECT migration_name, finished_at, rolled_back_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at;"
```

This will show you every migration Prisma knows about, including any that might be in a failed or pending state.

## Step 2: Compare with files on disk

Count migration files:
```bash
find packages/db/prisma/migrations -name "migration.sql" | wc -l
```

You should see 17 files, but Prisma says 18 migrations. Find which one is in the database but missing its file.

## Step 3: Resolve the missing migration

Once you identify the migration name (e.g., `20250120000001_add_rfp_vendor_portal`), mark it as rolled back:

```bash
docker-compose exec api sh -c "cd /workspace/packages/db && pnpm prisma migrate resolve --rolled-back <migration_name>"
```

## Step 4: Alternative - Check for hidden/empty directories

Sometimes Prisma sees directories we don't. Check inside Docker:

```bash
docker-compose exec api sh -c "cd /workspace/packages/db && find prisma/migrations -type d -mindepth 1 -maxdepth 1 | wc -l"
docker-compose exec api sh -c "cd /workspace/packages/db && find prisma/migrations -type d -mindepth 1 -maxdepth 1"
```

This will show what Prisma actually sees inside the container.

