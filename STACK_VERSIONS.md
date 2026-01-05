# Stack Versions

This document tracks the current versions of all major dependencies in the dp-v4 project.

**Last Updated:** January 2026

## Core Framework Versions

| Package | Version | Notes |
|---------|---------|-------|
| **Node.js** | 24.0.0+ | LTS version (upgraded from 20.x due to EOL April 2026) |
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

### Phase 5: Critical Node.js Upgrade (January 2026)
- ✅ Node.js 20.x → 24 LTS (URGENT: Node.js 20 EOL April 30, 2026)
- ✅ Updated `package.json` engines field: `>=20.9.0` → `>=24.0.0`
- ✅ Updated Dockerfiles: `node:20-alpine` → `node:24-alpine` (apps/api, apps/web)
- ✅ Updated `@types/node`: `^20.19.25` → `^24.0.0` (apps/api, apps/web, packages/lib)

### Phase 6: Security Vulnerability Fixes (January 2026)
- ✅ Fixed `qs` vulnerability (CVE via GHSA-6rw7-vpxm-498p): Added pnpm override to force `qs@>=6.14.1`
  - **Vulnerability**: DoS via memory exhaustion in arrayLimit bypass
  - **Path**: `shadcn > @modelcontextprotocol/sdk > express > qs`
  - **Solution**: Added `pnpm.overrides` to force patched version across all transitive dependencies
- ✅ Fixed React 19 peer dependency warnings: Added `@types/react: "19"` to `peerDependencyRules`

### Phase 7: Patch Updates (January 2026)
- ✅ Turbo 2.7.0 → 2.7.2 (patch update)

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

### Node.js 24 LTS (January 2026)
- **Status**: ✅ Critical upgrade - Node.js 20 EOL April 30, 2026
- **Upgrade Reason**: Node.js 20 LTS reaches end-of-life in April 2026, requiring upgrade to maintain security updates
- **Target Version**: Node.js 24 LTS (entered LTS October 2025, supported until April 2028)
- **Changes**: Updated engines field, Dockerfiles, and @types/node across all packages
- **Breaking Changes**: None expected - Node.js 24 is backward compatible with Node.js 20 code

## Version Requirements

### Minimum Requirements
- Node.js: >=24.0.0 (upgraded from 20.9.0+ due to EOL)
- pnpm: >=10.0.0

### Engine Requirements
See `package.json` for exact engine requirements:
```json
{
  "engines": {
    "node": ">=24.0.0",
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

## Deprecated Subdependencies

The following deprecated subdependencies are pulled in by transitive dependencies (not directly used):
- `fstream@1.0.12` - from older build tools
- `glob@7.2.3` - from older packages (glob v9+ available)
- `inflight@1.0.6` - from older packages (has memory leaks)
- `lodash.isequal@4.5.0` - from older lodash packages
- `node-domexception@1.0.0` - from jsdom/polyfills (use native DOMException)
- `rimraf@2.7.1` - from older packages (rimraf v4+ available)

**Status:** Non-critical warnings. These are deep in the dependency tree and don't affect functionality.

**Likely sources:**
- `exceljs@4.4.0` - may use older dependencies
- `pdfkit@0.15.0` - may use older dependencies  
- `jszip@3.10.1` - may use older dependencies
- `jsdom@23.0.1` - uses `node-domexception` for polyfills

**Action:** Monitor for updates to parent packages. No immediate action required unless security issues are discovered.


