# dp-v4
Dynamic Purchase - new take

# Purpose

The purpose with this app, Dynamic Purchase, is to create an application that can support all the necessary stages needed when doing RFI, RFP, ITTs and the like, from setting up the project until an agreement is signed or solution is purchased.

# Project Overview

A lean full-stack web application built using a turborepo structure, developed locally with Docker, and deployed to AWS.  
This README outlines the tech stack, goals, structure, and setup steps.

---

## Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query (server state)
- React Hook Form + Zod (forms + validation)
- Optional: NextAuth or AWS Cognito integration

### Backend
- Fastify (Node.js + TypeScript)
- Zod for runtime validation
- PostgreSQL
- Prisma ORM
- Optional: tRPC

### DevOps & Infrastructure
- Docker for local development
- docker-compose (web + api + postgres)
  - Monorepo-aware: entire workspace mounted for proper pnpm workspace resolution
  - Automatic dependency installation and Prisma client generation
- AWS (ECS Fargate or EKS)
- AWS Secrets Manager for secrets
- Terraform or AWS CDK (TypeScript)
- GitHub Actions for CI/CD

### Testing
- Vitest
- Supertest (backend)
- Playwright (E2E)
- ESLint + Prettier

---

## Directory Structure
```
root/
apps/
web/            # Next.js frontend
api/            # Fastify backend
packages/
ui/             # Shared components
config/         # Shared config (tsconfig, eslint, etc)
lib/            # Shared business logic
infra/
cdk/ or terraform/
docker/           # Docker configs
.github/workflows/
```

---

## Initial Setup

### Option 1: Docker (Recommended)

1. **Install dependencies locally (for tooling):**
   ```bash
   pnpm install
   ```

2. **Start all services with Docker:**
   ```bash
   docker-compose up --build
   ```

   This will:
   - Start PostgreSQL database
   - Start Fastify API on port 3001
   - Start Next.js app on port 3000
   - Automatically install all workspace dependencies
   - Generate Prisma client

3. **Run database migrations:**
   ```bash
   docker-compose exec api sh -c "cd /workspace/packages/db && pnpm db:migrate"
   ```

4. **Optional: Seed database:**
   ```bash
   docker-compose exec api sh -c "cd /workspace/packages/db && pnpm db:seed"
   ```

### Option 2: Local Development

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
   pnpm db:seed  # Optional
   ```

4. **Start development servers:**
   ```bash
   pnpm dev
   ```

### Lint
```bash
pnpm lint
```

## Core Principles
	•	Keep the codebase lean
	•	Strong type-safety end-to-end
	•	All boundaries use Zod validation
	•	Shared logic kept in clean packages
	•	Reproducible deployments via Docker

---

## Environment Variables

.env and .env.* files are ignored, except *.env.example.

Production secrets come from AWS Secrets Manager.

---

## CI/CD

Recommended pipeline steps:
	1.	Install
	2.	Lint
	3.	Test
	4.	Build
	5.	Deploy to AWS (ECS/EKS)

  
