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

### 1. Install dependencies
pnpm install

### 2. Start local dev
docker-compose up --build

This runs:
	•	Next.js app
	•	Fastify API
	•	PostgreSQL

### 3. Run database migrations
pnpm prisma migrate dev

### 4. Lint
pnpm lint

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

  
