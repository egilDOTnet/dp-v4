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
