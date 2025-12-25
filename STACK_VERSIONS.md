# Stack Versions

This document tracks the current versions of all major dependencies in the dp-v4 project.

**Last Updated:** January 2025

## Core Framework Versions

| Package | Version | Notes |
|---------|---------|-------|
| **Node.js** | 20.9.0+ | LTS version required |
| **pnpm** | 10.26.1 | Package manager |
| **TypeScript** | 5.9.3 | Latest 5.9.x |

## Frontend Stack

| Package | Version | Notes |
|---------|---------|-------|
| **Next.js** | 16.1.0 | App Router |
| **React** | 19.2.3 | Includes security fixes (CVE-2025-55184, CVE-2025-67779, CVE-2025-55183) |
| **React DOM** | 19.2.3 | Matches React version |
| **Tailwind CSS** | 4.1.18 | Latest 4.1.x |
| **React Hook Form** | 7.68.0 | Form management |
| **Zod** | 4.2.1 | Schema validation (major version upgrade) |

## Backend Stack

| Package | Version | Notes |
|---------|---------|-------|
| **Fastify** | 5.6.2 | Web framework |
| **Prisma** | 7.2.0 | ORM (includes @prisma/client) |
| **@prisma/client** | 7.2.0 | Prisma client |
| **@prisma/adapter-pg** | 7.2.0 | PostgreSQL adapter |
| **Zod** | 4.2.1 | Runtime validation |

## Build Tools & Dev Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| **Turborepo** | 2.7.0 | Monorepo build system |
| **Vitest** | 4.0.16 | Testing framework (major version upgrade) |
| **ESLint** | 9.39.2 | Linting |
| **TypeScript ESLint** | 8.49.0 | TypeScript linting |

## Recent Upgrades

### Phase 1: Critical Security Updates (January 2025)
- ✅ React 19.2.1 → 19.2.3 (Security vulnerabilities fixed)

### Phase 2: Safe Minor/Patch Updates (January 2025)
- ✅ Next.js 16.0.10 → 16.1.0
- ✅ Prisma 7.1.0 → 7.2.0
- ✅ Tailwind CSS 4.1.14 → 4.1.18
- ✅ react-hook-form 7.67.0 → 7.68.0
- ✅ Turbo 2.6.1 → 2.7.0
- ✅ pnpm 10.25.0 → 10.26.1

### Phase 3: Major Version Updates (January 2025)
- ✅ Zod 3.25.76 → 4.2.1 (Breaking changes: unified error handling)
- ✅ Vitest 3.2.0 → 4.0.16 (Breaking changes: poolOptions removed, use maxWorkers/isolate)

### Phase 4: Stack Cleanup (January 2025)
- ✅ Standardized `@eslint/js` to `^9.39.2` across all packages
- ✅ Updated `tsx` to `^4.21.0` in `apps/web` to match other packages
- ✅ Removed redundant `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` (using unified `typescript-eslint` package)
- ✅ Removed unused `@eslint/eslintrc` dependency (ESLint 9 uses flat config)
- ✅ Added `*.tsbuildinfo` to `.gitignore` and cleaned up build artifacts

## Breaking Changes & Migration Notes

### Zod 4.2.1
- **Breaking Change**: Unified error handling replaces `message`, `required_error`, `invalid_type_error` with single `error` parameter
- **Status**: ✅ Migrated - No code changes needed (project didn't use deprecated methods)
- **New Features**: Strongly-typed metadata, built-in JSON Schema conversion

### Vitest 4.0.16
- **Breaking Change**: `poolOptions.threads.singleThread` removed
- **Migration**: Use `maxWorkers: 1` and `isolate: false` instead
- **Status**: ✅ Migrated - Config files updated
- **Breaking Change**: `basic` reporter removed (use `default` with `summary: false`)
- **Status**: ✅ Not affected - Project doesn't use `basic` reporter

### Prisma 7.2.0
- **Status**: ✅ Safe upgrade - No breaking changes
- **New Features**: Reintroduced `--url` flag, improved `prisma init` output

### React 19.2.3
- **Status**: ✅ Security update - No breaking changes
- **Security Fixes**: CVE-2025-55184, CVE-2025-67779 (DoS), CVE-2025-55183 (Source code exposure)

## Version Requirements

### Minimum Requirements
- Node.js: >=20.9.0
- pnpm: >=10.0.0

### Engine Requirements
See `package.json` for exact engine requirements:
```json
{
  "engines": {
    "node": ">=20.9.0",
    "pnpm": ">=10.0.0"
  }
}
```

## Checking Current Versions

To check installed versions:
```bash
# Check package versions in lockfile
pnpm list --depth=0

# Check specific package
pnpm list react next prisma zod vitest

# Check Node.js version
node --version

# Check pnpm version
pnpm --version
```

## Upgrade History

See the upgrade plan for detailed migration notes:
- `.cursor/plans/stack_version_review_and_upgrade_plan_*.plan.md`


