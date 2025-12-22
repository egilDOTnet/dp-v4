# API Serialization Best Practices

## Overview

This document outlines best practices for ensuring Prisma data serializes correctly in Fastify API endpoints.

## Key Principles

### 1. Use `select` Instead of `include`

**Why**: Prisma's `include` returns model instances with non-enumerable properties and complex prototypes that Fastify cannot serialize properly.

**✅ Good**:
```typescript
const questions = await db.rFIQuestion.findMany({
  where: { rfiId: rfi.id },
  select: {
    id: true,
    title: true,
    description: true,
    // ... all fields explicitly selected
    options: {
      select: {
        id: true,
        label: true,
        // ... all option fields
      },
    },
  },
});
return reply.send(questions);
```

**❌ Bad**:
```typescript
const questions = await db.rFIQuestion.findMany({
  where: { rfiId: rfi.id },
  include: {
    options: true,
  },
});
return reply.send(questions); // May serialize as empty objects
```

### 2. Avoid Strict Schema Validation for Prisma Responses

**Why**: Fastify's schema validation can strip properties from Prisma objects even when using `select`, resulting in empty objects in responses.

**✅ Good**:
```typescript
schema: {
  response: {
    200: {
      description: "Array of RFI questions",
      // No schema validation - return data as-is to avoid serialization issues
      // Fastify's schema validation can strip properties from Prisma objects
      // even when using select. Using only description allows proper serialization.
    },
  },
}
```

**❌ Bad**:
```typescript
schema: {
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          // ... strict schema definition
        },
      },
    },
  },
}
// This can cause Fastify to strip properties not explicitly defined
```

### 3. Use Direct Model Access with `findMany`

**Why**: When querying related data, use `findMany` directly on the model rather than extracting from nested relations.

**✅ Good**:
```typescript
// Get parent ID first
const rfi = await db.rFI.findUnique({
  where: { projectId },
  select: { id: true },
});

// Then query related data directly
const questions = await db.rFIQuestion.findMany({
  where: { rfiId: rfi.id },
  select: { /* ... */ },
});
```

**❌ Bad**:
```typescript
// Extracting from nested relation can cause serialization issues
const rfi = await db.rFI.findUnique({
  where: { projectId },
  select: {
    questions: { select: { /* ... */ } },
  },
});
const questions = rfi.questions; // May not serialize correctly
```

### 4. Never Use `reply.raw` for JSON Responses

**Why**: `reply.raw` bypasses Fastify's CORS middleware, causing CORS errors in browsers.

**✅ Good**:
```typescript
return reply.send(data);
```

**❌ Bad**:
```typescript
reply.raw.setHeader('Content-Type', 'application/json');
reply.raw.statusCode = 200;
reply.raw.end(JSON.stringify(data)); // Bypasses CORS!
```

## Common Patterns

### Pattern 1: Simple List Endpoint

```typescript
fastify.get("/items", {
  schema: {
    response: {
      200: {
        description: "Array of items",
        // No strict validation
      },
    },
  },
}, async (request, reply) => {
  const items = await db.item.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });
  return reply.send(items);
});
```

### Pattern 2: Nested Relations

```typescript
const items = await db.item.findMany({
  select: {
    id: true,
    name: true,
    children: {
      select: {
        id: true,
        name: true,
      },
      orderBy: { order: "asc" },
    },
  },
});
return reply.send(items);
```

### Pattern 3: Error Responses

Error responses can use strict schemas since they're simple objects:

```typescript
schema: {
  response: {
    401: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
    500: {
      type: "object",
      properties: {
        error: { type: "string" },
        message: { type: "string" },
      },
    },
  },
}
```

## Troubleshooting

### Issue: Empty Objects in Response

**Symptoms**: API returns `[{},{},{},{}]` instead of data, but server logs show data is present.

**Solutions**:
1. Check if using `include` - change to `select`
2. Check response schema - remove strict `type` validation
3. Verify not using `reply.raw` - use `reply.send()` instead

### Issue: CORS Errors

**Symptoms**: Browser shows CORS error when calling endpoint.

**Solutions**:
1. Ensure using `reply.send()` not `reply.raw`
2. Verify CORS is configured in `apps/api/src/index.ts`
3. Check that CORS middleware is registered before routes

### Issue: Missing Properties

**Symptoms**: Some properties are missing from response even though they're in the database.

**Solutions**:
1. Verify `select` includes all needed fields
2. Check if response schema is too strict
3. Ensure nested relations use `select` not `include`

## Related Files

- `/apps/api/src/routes/requirements.ts` - Mixed patterns:
  - ✅ Hierarchies endpoint: Uses `select` correctly
  - ⚠️ Requirements list endpoint: Still uses `include` (should be converted)
- `/apps/api/src/routes/rfi.ts` - Fixed endpoints using these patterns
- `/apps/api/src/routes/templates.ts` - Simple example that works correctly

## Important Note on `include` Usage

**When `include` is acceptable:**
- Internal queries that aren't returned to the client
- Validation checks (e.g., checking if a record exists and belongs to a project)
- Helper functions that process data but don't serialize it

**When `include` must be avoided:**
- Any query result that is passed to `reply.send()`
- Data that will be serialized and sent to the client
- Endpoints that return Prisma query results directly

## Date Formatting Standards

### Use ISO 8601 Format

**Why**: Avoid locale-specific date formatting (like US-style MM/DD/YYYY) that can confuse international users. ISO format is unambiguous and universally understood.

**✅ Good**:
```typescript
import { formatISODateTime, formatISODate } from "@/lib/utils";

// For date-time: YYYY-MM-DD HH:mm:ss
const formatted = formatISODateTime(dateString); // "2024-01-15 14:30:45"

// For date only: YYYY-MM-DD
const formatted = formatISODate(dateString); // "2024-01-15"
```

**❌ Bad**:
```typescript
// Avoid locale-specific formatting
date.toLocaleString(); // "1/15/2024, 2:30:45 PM" (US format)
date.toLocaleDateString(); // "1/15/2024" (US format)
date.toLocaleDateString("en-US"); // US format
```

### Utility Functions

Use the date formatting utilities in `/apps/web/src/lib/utils.ts`:
- `formatISODateTime(date)`: Returns `YYYY-MM-DD HH:mm:ss` format
- `formatISODate(date)`: Returns `YYYY-MM-DD` format

Both functions handle:
- String dates
- Date objects
- Null/undefined values (returns "-")

### When to Use Each Format

- **Date-Time** (`formatISODateTime`): For timestamps, sent dates, answered dates, created/updated times
- **Date Only** (`formatISODate`): For deadlines, start/end dates, date-only fields

## References

- [Prisma Select Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/select-fields)
- [Fastify Schema Documentation](https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/)
- [ISO 8601 Date Format Standard](https://en.wikipedia.org/wiki/ISO_8601)





