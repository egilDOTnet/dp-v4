## Dev environment tips
- Use `pnpm dlx turbo run where <project_name>` to jump to a package instead of scanning with `ls`.
- Run `pnpm install --filter <project_name>` to add a package to the workspace so ESLint, TypeScript, and Next.js/Fastify tooling can see it.
- For new frontend packages, use the existing Next.js setup instead of Vite templates.
- Check each package’s `package.json` name field to be sure you’re referencing the correct workspace name.

## Testing instructions
- CI pipeline configuration lives in `.github/workflows/`.
- Run `pnpm turbo run test --filter <project_name>` to run tests for a specific package.
- From a package root, you can run `pnpm test` directly.
- Use Vitest filters to run one specific test:  
  `pnpm vitest run -t "<test name>"`
- Fix any test or type errors until the suite is green. PRs should not fail linting or tests.
- After moving files or changing imports, run:  
  `pnpm lint --filter <project_name>`  
  to validate ESLint and TypeScript rules.
- Add or update tests for any code you change, even if nobody asked.

## PR instructions
- Use the title format: `[<project_name>] <Title>`
- Always run `pnpm lint` and `pnpm test` before committing.