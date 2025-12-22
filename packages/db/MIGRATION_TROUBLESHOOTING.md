# Prisma Migration Troubleshooting Guide

## Shadow Database Error (P3006 / P1014)

### The Problem

When running `prisma migrate dev`, you may encounter this error:

```
Error: P3006
Migration `20241208_add_theme_to_user` failed to apply cleanly to the shadow database. 
Error code: P1014
Error:
The underlying table for model `User` does not exist.
```

### Why This Happens

This error occurs because:

1. **Prisma uses a shadow database** during `migrate dev` to validate migrations. It creates a temporary database and applies all migrations from scratch to ensure they work correctly.

2. **Your first migration tries to ALTER a table** (`User`) that doesn't exist in the fresh shadow database because there's no earlier migration that creates it.

3. **Your database was created before migrations were tracked** - likely using `prisma db push` or manual SQL, so the initial schema creation isn't captured in your migration history.

4. When Prisma applies migrations to the shadow database in order, the first migration fails because it tries to ALTER a table that was never created by a migration.

### Immediate Workaround (Current Solution)

**Use `--create-only` flag** when creating new migrations:

```bash
cd packages/db
pnpm prisma migrate dev --name your_migration_name --create-only
```

**What `--create-only` does:**
- Creates the migration file without applying it
- Skips shadow database validation
- Allows you to review the migration SQL before applying

**After creating the migration:**
1. Review the generated SQL in `prisma/migrations/[timestamp]_your_migration_name/migration.sql`
2. Apply the migration when ready:
   ```bash
   pnpm prisma migrate dev
   ```
   Or deploy it in production:
   ```bash
   pnpm prisma migrate deploy
   ```

### Recommended Script Usage

We've added a convenience script in `package.json`:

```bash
# Create a migration without applying it (skips shadow DB validation)
pnpm db:migrate:create-only --name your_migration_name

# Apply existing migrations
pnpm db:migrate
```

### The Proper Long-Term Fix

To permanently fix this issue, you need to create a **baseline migration** that represents the initial database state before your existing migrations:

1. **Create a baseline migration** that creates all base tables (User, Project, Tenant, etc.)
   - This should be dated before `20241208_add_theme_to_user`
   - Generate it by creating a schema snapshot from your current database

2. **Mark it as already applied** (since your database already has these tables):
   ```bash
   pnpm prisma migrate resolve --applied <baseline_migration_name>
   ```

3. **Reorder migrations** so the baseline comes first chronologically

**Note:** This is a significant refactoring that requires careful planning and coordination, especially in a team environment. The `--create-only` workaround is safe to continue using in the meantime.

### Alternative: Configure Shadow Database URL

If you have a dedicated database for shadow operations, you can set:

```bash
export SHADOW_DATABASE_URL="postgresql://user:password@localhost:5432/shadow_db"
```

This allows Prisma to use a specific database for shadow operations instead of trying to create a temporary one.

### Best Practices Going Forward

1. **Always use migrations** - Never use `prisma db push` for schema changes that need to be tracked
2. **Review migrations before applying** - Use `--create-only` to review SQL first
3. **Keep migration history clean** - Ensure each migration can be applied independently
4. **Test migrations** - Run `prisma migrate dev` on a fresh database to ensure migrations work from scratch

### When to Use Each Command

- **`prisma migrate dev`** - Development: Creates and applies migrations, generates Prisma Client
- **`prisma migrate dev --create-only`** - Development: Creates migration file only, skips validation
- **`prisma migrate deploy`** - Production: Applies pending migrations without generating client
- **`prisma db push`** - Prototyping only: Pushes schema directly, doesn't create migration files

### Related Issues

- If you see this error, it means your migration history is incomplete
- This is a common issue when projects transition from `db push` to migrations
- The workaround is safe and doesn't affect production deployments



