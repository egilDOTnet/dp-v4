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
- **Next.js 16.1.0** (App Router)
- **React 19.2.3** (with React DOM)
- **TypeScript 5.9.3**
- **Tailwind CSS 4.1.18**
- shadcn/ui
- React Query (server state)
- **React Hook Form 7.68.0** + **Zod 4.2.1** (forms + validation)
- Optional: NextAuth or AWS Cognito integration

### Backend
- **Fastify 5.6.2** (Node.js + TypeScript)
- **Zod 4.2.1** for runtime validation
- PostgreSQL
- **Prisma ORM 7.2.0** (with @prisma/client)
- Optional: tRPC

### DevOps & Infrastructure
- Docker for local development
- docker-compose (web + api + postgres)
  - Monorepo-aware: entire workspace mounted for proper pnpm workspace resolution
  - Automatic dependency installation and Prisma client generation
- **Turborepo 2.7.0** (monorepo build system)
- **pnpm 10.26.1** (package manager)
- AWS (ECS Fargate or EKS)
- AWS Secrets Manager for secrets
- Terraform or AWS CDK (TypeScript)
- GitHub Actions for CI/CD

### Testing
- **Vitest 4.0.16**
- Supertest (backend)
- Playwright (E2E)
- ESLint 9.39.2 + Prettier

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

**Prerequisites:** Node.js 20.9.0+, pnpm 10.26.1+, Docker

See [SETUP.md](./SETUP.md) for detailed setup instructions.

### Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start all services with Docker:**
   ```bash
   docker-compose up --build
   ```

3. **Run database migrations:**
   ```bash
   docker-compose exec api sh -c "cd /workspace/packages/db && pnpm db:migrate"
   ```

For more details:
- **Setup Instructions**: [SETUP.md](./SETUP.md)
- **Stack Versions**: [STACK_VERSIONS.md](./STACK_VERSIONS.md)

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

## Documentation

- **[SETUP.md](./SETUP.md)** - Detailed setup and troubleshooting guide
- **[STACK_VERSIONS.md](./STACK_VERSIONS.md)** - Current dependency versions and upgrade history
- **[API_DOCUMENTATION.md](./apps/api/API_DOCUMENTATION.md)** - API endpoint documentation

  
