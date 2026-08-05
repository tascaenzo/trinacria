# Repository: Biome Toolchain

The monorepo uses Biome as the primary quality tool for JavaScript, TypeScript,
and JSON. It replaces ESLint and handles linting, formatting, and import
organization through one configuration and one binary.

Prettier remains scoped to Markdown and YAML because Biome does not currently
provide stable formatting for those repository formats.

## Configuration

The root `biome.json` enables:

- Git-aware file discovery;
- the recommended lint preset;
- compatibility exceptions carried over from the former ESLint policy;
- deterministic two-space formatting;
- safe import organization;
- force-ignore rules for generated and build output.

## Commands

```bash
npm run check
npm run check:fix
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

`check` is the CI-grade command. It runs the Biome formatter check, linter, and
assist rules. `check:fix` applies safe fixes. Unsafe fixes always require an
explicit manual review.

## CI and hooks

CI runs formatting, Biome checks, build, tests, coverage, and dependency audit.
The pre-commit hook applies Biome checks only to staged JavaScript and TypeScript
files, then builds and tests the affected workspaces.

When changing the quality toolchain, update `biome.json`, `package.json`, the
lockfile, CI workflows, pre-commit script, and this guide together.
