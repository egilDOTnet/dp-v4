# Setup Instructions

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker and Docker Compose
- PostgreSQL (via Docker)

## Initial Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start Docker services:**
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
   
   Create `.env` files in `apps/api` and `apps/web` (see `.env.example` files for reference):
   
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

