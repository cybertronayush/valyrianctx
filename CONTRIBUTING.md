# Contributing to ValyrianCtx

Thank you for your interest in contributing. This document covers the process and standards for contributing to ValyrianCtx.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/cybertronayush/valyrianctx.git
cd valyrianctx

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run the CLI locally
npm run dev -- save "test message"
```

## Development Workflow

1. **Fork the repository** and create a branch from `main`.
2. **Name your branch** descriptively: `fix/parser-cursor-crash`, `feat/windsurf-support`, `docs/api-reference`.
3. **Write code.** Follow the existing patterns in the codebase.
4. **Write tests.** All new functionality needs test coverage. Run `npm test` to verify.
5. **Build successfully.** Run `npm run build` — TypeScript must compile with zero errors.
6. **Open a pull request** against `main` with a clear description of what changed and why.

## Code Standards

### TypeScript

- **Strict mode is enforced.** The tsconfig has `"strict": true`. Do not weaken it.
- **No `any` types** unless absolutely unavoidable (and documented with a comment).
- **Use explicit return types** on exported functions.
- **Prefer `const` over `let`.** Never use `var`.

### File Structure

```
src/
  index.ts            # CLI entry point (Commander.js)
  mcp-server.ts       # MCP server entry point
  core/               # Core logic (context, git, parser, AI, types)
  commands/            # CLI command handlers (one file per command)
  utils/              # Utilities (config, clipboard)
```

- **One command per file** in `commands/`.
- **Core logic goes in `core/`**, not in command handlers. Commands are thin wrappers.
- **Tests live next to the code** they test: `parser.ts` -> `parser.test.ts`.

### Commit Messages

Use conventional commits:

```
feat: add Windsurf parser support
fix: handle missing ~/.cursor directory gracefully
docs: update IDE compatibility table
test: add agent-rules removal tests
chore: update dependencies
```

The format is: `type: short description` (lowercase, no period, imperative mood).

### Adding a New IDE

If you're adding support for a new AI coding IDE:

1. **Add a parser** in `src/core/parser.ts` — implement `extractFrom<IDE>()` following the existing pattern.
2. **Add agent rules** in `src/core/agent-rules.ts` — add an entry to `getAllIDERules()` with the correct file path and content for that IDE.
3. **Add tests** for both the parser and the rule generation.
4. **Update the README** — add the IDE to the compatibility table and the "Alliances & Integrations" section.
5. **Update this document** if the setup process changes.

## Pull Request Process

1. Ensure `npm run build` and `npm test` pass.
2. Update documentation if your change affects user-facing behavior.
3. Fill out the PR template completely.
4. One approval is required before merge.
5. Squash merge is preferred for clean history.

## Reporting Bugs

Use the [Bug Report](https://github.com/cybertronayush/valyrianctx/issues/new?template=bug_report.yml) issue template. Include:

- ValyrianCtx version (`valyrianctx --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs. actual behavior

## Requesting Features

Use the [Feature Request](https://github.com/cybertronayush/valyrianctx/issues/new?template=feature_request.yml) issue template. Describe:

- The problem you're trying to solve
- Your proposed solution
- Alternatives you've considered

## Security Vulnerabilities

**Do not open a public issue.** See [SECURITY.md](./SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
