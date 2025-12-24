# Next.js Routing Guide

## Quick Reference

This guide covers Next.js App Router routing rules and common pitfalls to avoid.

## Route Types

### Static Routes
- Regular folders create static routes: `app/about/page.tsx` → `/about`

### Dynamic Routes
- Single parameter: `app/rfi/[token]/page.tsx` → `/rfi/abc123`
- Multiple parameters: `app/projects/[id]/tasks/[taskId]/page.tsx` → `/projects/1/tasks/2`

### Catch-All Routes
- Capture multiple segments: `app/docs/[...slug]/page.tsx` → `/docs/a/b/c`
- **⚠️ CRITICAL:** Catch-all routes MUST be the last segment in the path

## Common Errors

### ❌ Error: "Invalid segment Static(...), catch all segment must be the last segment"

**What causes it:**
Having a catch-all route with nested static segments after it.

**Example of invalid structure:**
```
app/
  (vendor)/
    rfi/
      [...token]/          ← Catch-all route
        contact/            ← ❌ Static segment after catch-all (INVALID)
          page.tsx
        questions/          ← ❌ Static segment after catch-all (INVALID)
          page.tsx
```

**Why it fails:**
Next.js/Turbopack cannot determine which route to match when a catch-all is followed by static segments. The catch-all would consume all path segments, leaving nothing for the static segments.

**✅ Correct solution:**
Use a dynamic route instead of a catch-all:

```
app/
  (vendor)/
    rfi/
      [token]/             ← ✅ Dynamic route (single parameter)
        contact/            ← ✅ Valid nested route
          page.tsx
        questions/          ← ✅ Valid nested route
          page.tsx
        page.tsx
```

## When to Use Each Route Type

### Use `[param]` (Dynamic Route) when:
- ✅ You have a single parameter (e.g., token, ID)
- ✅ You need nested routes after the parameter
- ✅ The parameter is always a single segment

**Example:**
```
app/rfi/[token]/contact/page.tsx     → /rfi/abc123/contact
app/rfi/[token]/questions/page.tsx   → /rfi/abc123/questions
```

### Use `[...param]` (Catch-All Route) when:
- ✅ You need to capture multiple path segments
- ✅ It's the LAST segment in your route structure
- ✅ You don't have any nested static routes after it

**Example:**
```
app/docs/[...slug]/page.tsx          → /docs/getting-started/installation
app/docs/[...slug]/page.tsx          → /docs/api/reference/endpoints
```

### ❌ Never use `[...param]` when:
- You have nested static routes (like `contact`, `questions`)
- You only need a single parameter value

## Route Groups

Route groups `(groupName)` organize routes without affecting the URL:
- `app/(vendor)/rfi/[token]/page.tsx` → `/rfi/abc123` (not `/vendor/rfi/abc123`)
- Useful for layouts, organization, and conditional routing

## Troubleshooting

### Web server stuck in restart loop

**Symptoms:**
- Docker container keeps restarting
- Error in logs: "Invalid segment Static(...), catch all segment must be the last segment"

**Fix:**
1. Check for duplicate route directories:
   ```bash
   find apps/web/src/app -type d -name "*token*"
   ```

2. Remove catch-all route if you have both `[token]` and `[...token]`:
   ```bash
   rm -rf apps/web/src/app/(vendor)/rfi/\[...token\]
   ```

3. Ensure you're using `[token]` (dynamic) not `[...token]` (catch-all) when you have nested routes

### Route not matching

- Check for typos in folder names
- Ensure `page.tsx` exists in the route folder
- Verify route groups `(name)` don't affect the URL path
- Check for conflicting routes (both dynamic and catch-all)

## Best Practices

1. **Prefer dynamic routes over catch-all** unless you specifically need multiple segments
2. **Check existing routes** before creating new ones to avoid conflicts
3. **Use route groups** for organization without affecting URLs
4. **Test routes immediately** after creation to catch routing errors early
5. **Keep route structure flat** when possible - avoid deep nesting
6. **Use the Breadcrumbs component** for all page navigation (see `DESIGN_SYSTEM.md` for details)

## Examples

### ✅ Good: Dynamic route with nested routes
```
app/
  rfi/
    [token]/
      page.tsx           → /rfi/abc123
      contact/
        page.tsx         → /rfi/abc123/contact
      questions/
        page.tsx         → /rfi/abc123/questions
```

### ✅ Good: Catch-all as final segment
```
app/
  docs/
    [...slug]/
      page.tsx           → /docs/any/nested/path
```

### ❌ Bad: Catch-all with nested routes
```
app/
  rfi/
    [...token]/          ← Catch-all
      contact/           ← ❌ Static segment after catch-all
        page.tsx
```

### ✅ Good: Route groups for organization
```
app/
  (vendor)/
    rfi/
      [token]/
        page.tsx         → /rfi/abc123 (not /vendor/rfi/abc123)
  (main)/
    projects/
      [id]/
        page.tsx         → /projects/123 (not /main/projects/123)
```

## Related Documentation

- [Next.js App Router Documentation](https://nextjs.org/docs/app/building-your-application/routing)
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)



