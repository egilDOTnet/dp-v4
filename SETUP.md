# Setup Instructions

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker and Docker Compose
- PostgreSQL (via Docker)

## Setup Options

### Option 1: Full Docker Setup (Recommended)

This setup runs everything in Docker containers, including the development servers. The entire monorepo workspace is mounted, so all workspace dependencies are properly resolved.

1. **Install dependencies locally (for tooling like Prisma CLI):**
   ```bash
   pnpm install
   ```

2. **Start all services:**
   ```bash
   docker-compose up --build
   ```

   This will:
   - Start PostgreSQL database
   - Start Fastify API on port 3001
   - Start Next.js app on port 3000
   - Automatically install all workspace dependencies
   - Generate Prisma client

3. **Set up database:**
   ```bash
   # Run migrations
   docker-compose exec api sh -c "cd /workspace/packages/db && pnpm db:migrate"
   
   # Optional: Seed database
   docker-compose exec api sh -c "cd /workspace/packages/db && pnpm db:seed"
   ```

4. **Environment variables:**
   
   The Docker setup uses environment variables from `docker-compose.yml`. For local development, you may want to create `.env` files:
   
   `apps/api/.env`:
   ```
   DATABASE_URL="postgresql://postgres:postgres@postgres:5432/app"
   JWT_SECRET="your-secret-key-change-in-production"
   PORT=3001
   NODE_ENV=development
   ```
   
   `apps/web/.env`:
   ```
   NEXT_PUBLIC_API_URL="http://localhost:3001"
   ```

**Note:** The Docker setup mounts the entire workspace to `/workspace` in the containers, which allows pnpm to properly resolve all workspace dependencies (`@dp/config`, `@dp/db`, `@dp/lib`, `@dp/ui`).

### Option 2: Local Development

For local development without Docker (except for PostgreSQL):

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start PostgreSQL with Docker:**
   ```bash
   docker-compose up -d postgres
   ```

3. **Set up database:**
   ```bash
   cd packages/db
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed  # Optional: creates a test admin user
   ```

4. **Environment variables:**
   
   Create `.env` files in `apps/api` and `apps/web`:
   
   `apps/api/.env`:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/app"
   JWT_SECRET="your-secret-key-change-in-production"
   PORT=3001
   NODE_ENV=development
   ```
   
   `apps/web/.env`:
   ```
   NEXT_PUBLIC_API_URL="http://localhost:3001"
   ```

5. **Start development servers:**
   ```bash
   # From root directory
   pnpm dev
   ```
   
   Or start individually:
   ```bash
   # Terminal 1 - API
   cd apps/api
   pnpm dev
   
   # Terminal 2 - Web
   cd apps/web
   pnpm dev
   ```

## Access

- Web app: http://localhost:3000
- API: http://localhost:3001
- API Health: http://localhost:3001/health

## Troubleshooting

### Docker Issues

#### Containers won't start or dependencies not found

If you see errors about workspace packages not being found (`@dp/config`, etc.):

1. **Ensure the entire workspace is mounted:**
   The `docker-compose.yml` should mount the root directory (`.`), not individual app directories.

2. **Rebuild containers:**
   ```bash
   docker-compose down
   docker-compose up --build
   ```

3. **Check Prisma client generation:**
   If the API fails with Prisma errors, regenerate the client:
   ```bash
   docker-compose exec api sh -c "cd /workspace/packages/db && pnpm prisma generate"
   ```

#### Prisma OpenSSL errors

If you see OpenSSL-related errors with Prisma, the Docker images include OpenSSL. If issues persist, ensure the Prisma schema includes the correct binary targets for Alpine Linux (already configured in `packages/db/prisma/schema.prisma`).

### Migration Shadow Database Error (P3006 / P1014)

If you encounter a shadow database error when creating migrations (e.g., "The underlying table for model `User` does not exist"), see the detailed troubleshooting guide:

📖 **[Migration Troubleshooting Guide](./packages/db/MIGRATION_TROUBLESHOOTING.md)**

**Quick fix:** Use the `--create-only` flag when creating migrations:

```bash
cd packages/db
pnpm db:migrate:create-only --name your_migration_name
```

This creates the migration file without applying it, avoiding shadow database validation issues.

### Port Already in Use

If you get an error that port 3001 (or 3000) is already in use:

```bash
# Kill process on port 3001 (API)
./scripts/kill-port.sh 3001

# Kill process on port 3000 (Web)
./scripts/kill-port.sh 3000

# Or manually:
lsof -ti:3001 | xargs kill -9
```

### Docker Container Logs

To view logs for debugging:

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs api
docker-compose logs web

# Follow logs
docker-compose logs -f api
```

## Test User (if seeded)

- Email: `admin@example.com`
- Password: `admin123`
- Role: Global Administrator

## Development Notes

- Magic links are displayed in the UI during development (not sent via email)
- First user of a company is automatically assigned CompanyAdministrator role
- Company admins can see all company projects; regular users see only their assigned projects
- If a user has only one project, they are automatically redirected to it from the dashboard

## Project Structure

- `apps/web` - Next.js frontend (App Router)
- `apps/api` - Fastify backend
- `packages/db` - Prisma schema and database client
- `packages/lib` - Shared business logic and validation
- `packages/ui` - Shared React components
- `packages/config` - Shared configs (ESLint, TypeScript)

## Next Steps

Phase 1 is complete. The following features are planned for Phase 2:
- Project modules (Planning, RFI, Requirements, Documentation, Vendor Follow-up, Evaluation, Comparison, Negotiations)
- Vendor portal
- RFI response portal
- Global administrator interface
- SSO integration (Microsoft/Google)
- Passkey support

