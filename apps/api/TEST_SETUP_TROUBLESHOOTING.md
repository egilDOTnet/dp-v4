# Test Setup Troubleshooting

## ENFILE: File Table Overflow Error

### What is ENFILE?

`ENFILE` (Error: No File Table) occurs when your system runs out of available file descriptors. File descriptors are used by the operating system to track open files, network connections, and other resources.

### Why Does This Happen?

When running tests with Vitest, the test runner:
- Opens many source files for transformation
- Loads dependencies from `node_modules`
- Opens database connections
- Creates temporary files
- Watches for file changes

With a low file descriptor limit (like 256), these operations can quickly exhaust available descriptors.

### Current System Limits

On macOS, there are two types of limits:
1. **Soft limit** - The current limit for your session (can be changed with `ulimit`)
2. **Hard limit** - The maximum allowed limit (requires system configuration)

### Checking Your Current Limits

```bash
# Check current soft limit (per session)
ulimit -n

# Check system-wide limits (macOS)
launchctl limit maxfiles

# Check process-specific limits
lsof -p $$ | wc -l  # Count open files for current process
```

### Solutions

#### Solution 1: Increase Limit for Current Session (Temporary)

This only affects your current terminal session:

```bash
# Increase soft limit to 4096 (or higher)
ulimit -n 4096

# Then run tests
cd apps/api && pnpm test
```

**Note:** This resets when you close the terminal.

#### Solution 2: Increase System-Wide Limits (Permanent - Recommended)

For macOS, you need to increase both the soft and hard limits:

1. **Create or edit `/etc/launchd.conf`** (requires sudo):
   ```bash
   sudo nano /etc/launchd.conf
   ```

2. **Add these lines:**
   ```
   limit maxfiles 65536 200000
   ```
   (soft limit: 65536, hard limit: 200000)

3. **Reboot your Mac** for changes to take effect.

   OR, for current session only (no reboot needed):
   ```bash
   sudo launchctl limit maxfiles 65536 200000
   ```

4. **Verify the change:**
   ```bash
   launchctl limit maxfiles
   ```

5. **Set in your shell profile** (e.g., `~/.zshrc` or `~/.bash_profile`):
   ```bash
   ulimit -n 65536
   ```

#### Solution 3: Use a Test Script with Increased Limits

Create a test script that sets the limit before running tests:

```bash
#!/bin/bash
# apps/api/test.sh
ulimit -n 4096
pnpm test "$@"
```

Then run: `./apps/api/test.sh`

#### Solution 4: Optimize Vitest Configuration

If you can't increase system limits, optimize Vitest to use fewer file descriptors:

```typescript
// apps/api/vitest.config.ts
export default defineConfig({
  test: {
    // ... existing config
    pool: 'forks', // Use separate processes instead of threads
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork to reduce file descriptors
      },
    },
    // Reduce concurrent test execution
    maxConcurrency: 1,
  },
});
```

### Recommended Values

- **Minimum for development:** 4096
- **Recommended for development:** 65536
- **For CI/CD:** 65536 or higher

### Verifying the Fix

After increasing limits, verify:

```bash
# Check limits
ulimit -n
launchctl limit maxfiles

# Try running a simple test
cd apps/api && pnpm test -- --run src/__tests__/routes/auth.test.ts

# Monitor file descriptor usage during tests
watch -n 1 'lsof -p $(pgrep -f "vitest") | wc -l'
```

### Additional Troubleshooting

If issues persist after increasing limits:

1. **Check for file descriptor leaks:**
   ```bash
   # Before running tests
   lsof | wc -l
   
   # Run tests
   # After tests complete
   lsof | wc -l
   ```
   If the count doesn't return to baseline, there may be leaks.

2. **Check system resources:**
   ```bash
   # Check overall system file descriptor usage
   sysctl kern.maxfiles
   sysctl kern.maxfilesperproc
   ```

3. **Close unnecessary applications** that may be holding many file descriptors.

4. **Restart your terminal/IDE** to clear any lingering file handles.

### For CI/CD Environments

In CI/CD (GitHub Actions, etc.), you typically don't need to worry about this as:
- CI environments usually have higher default limits
- Each job runs in a fresh container/VM
- Tests run in isolation

If you encounter this in CI, add to your workflow:
```yaml
- name: Increase file descriptor limit
  run: ulimit -n 4096
```

### References

- [macOS File Descriptor Limits](https://superuser.com/questions/302754/increase-the-maximum-number-of-open-file-descriptors-in-snow-leopard)
- [Vitest Performance Tuning](https://vitest.dev/guide/performance.html)
- [Node.js File Descriptor Management](https://nodejs.org/api/fs.html#file-descriptors)





