# Integration Test Location Analysis

## Current Situation

Integration tests are located in `apps/web/src/__tests__/integration/` but are blocked by Prisma client resolution issues in Vitest config when importing API source code.

## Option: Move Integration Tests to `apps/api`

### Potential Problems

#### 1. **Architectural Dependency Issue** ⚠️ **CRITICAL**
- **Problem**: Integration tests currently use the API client from `apps/web/src/lib/api.ts`
- **Impact**: If we import `@dp/web` from `apps/api` for tests, we create an architectural dependency where the API package depends on the web package
- **Why it's bad**: APIs should be independent and not depend on frontend code
- **Workaround**: 
  - Extract shared types to a `@dp/types` package
  - Create a test-only API client in `apps/api` that uses fetch directly
  - Use fetch directly in tests instead of the API client

#### 2. **Browser-Specific API Usage** ✅ **Manageable**
- **Current**: API client uses `localStorage` and `window.location`
- **Impact**: These don't exist in Node.js
- **Mitigation**: 
  - API client already has guards: `if (typeof window !== 'undefined')`
  - Falls back to `process.env.NEXT_PUBLIC_API_URL` in Node
  - Token storage would need alternative (memory/Map instead of localStorage)

#### 3. **Type Definitions** ⚠️ **Medium Impact**
- **Current**: Types are defined in `apps/web/src/lib/api.ts` (User, Project, RFI, etc.)
- **Problem**: Tests need these types
- **Solutions**:
  - Extract types to shared package (`@dp/types`)
  - Duplicate type definitions (not ideal, maintenance burden)
  - Import from `@dp/web` as devDependency (creates architectural dependency)

#### 4. **Test Organization** ✅ **Minor**
- **Impact**: Integration tests would be in API package instead of web package
- **Consideration**: Tests test workflows from client perspective (HTTP requests), not direct API function calls
- **Philosophy**: Integration tests could legitimately live in either place since they test the full system

### Benefits of Moving to `apps/api`

#### 1. **Prisma Resolution Works Naturally** ✅
- API package already has Prisma as a dependency
- No need for complex Vitest configuration
- Tests would run immediately

#### 2. **Simpler Configuration** ✅
- API package's Vitest config already handles Prisma correctly
- No need for custom plugins or aliases

#### 3. **Better Separation of Concerns** ✅
- API tests (unit + integration) would be in one place
- Web package focuses on frontend-specific tests (components, pages)

### Recommended Approach

If moving to `apps/api`, create a **test-only API client** that:

1. **Doesn't depend on browser APIs**
   - Use in-memory token storage (Map/object)
   - Use environment variable for API URL
   - No window/localStorage dependencies

2. **Shares types appropriately**
   - Option A: Extract types to `@dp/types` package (best long-term)
   - Option B: Use API route response types directly from API routes
   - Option C: Duplicate minimal type definitions for tests

3. **Keeps architectural boundaries**
   - API package doesn't depend on `@dp/web`
   - Tests are test infrastructure, not runtime dependencies

### Implementation Steps

1. Create `apps/api/src/__tests__/integration/api-client.ts`:
   ```typescript
   // Test-only API client - no browser dependencies
   const tokenStore = new Map<string, string>();
   
   export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
     const token = tokenStore.get('token');
     // ... rest of implementation
   }
   ```

2. Move integration tests to `apps/api/src/__tests__/integration/`

3. Update imports to use test API client instead of `@/lib/api`

4. Share types via:
   - Extract to `@dp/types`, OR
   - Import response types from API route handlers

### Alternative: Keep Tests in `apps/web` but Fix Configuration

If keeping tests in `apps/web`, consider:

1. **Separate Test Server Process**: Start API server as separate Node process, only communicate via HTTP
2. **Custom Module Loader**: Use a plugin that loads API code via Node's require() instead of Vite transformation
3. **Pre-bundle API Code**: Bundle API routes separately, import the bundle in tests

## Recommendation

**Move integration tests to `apps/api`** with a test-only API client. This is the cleanest solution because:

1. ✅ Solves Prisma resolution issue immediately
2. ✅ Maintains architectural boundaries (API doesn't depend on web)
3. ✅ Better test organization (all API tests together)
4. ✅ Simpler configuration (no complex Vite setup needed)
5. ✅ Tests still test from client perspective (HTTP requests)

The main work is creating a test API client that doesn't depend on browser APIs, which is straightforward.
