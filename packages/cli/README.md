# @trinacria/cli - Implementation Guide

`@trinacria/cli` provides the `trinacria` command for development and runtime operations.

## What this package is responsible for

- command dispatch (`dev`, `build`, `start`)
- project config loading (`trinacria.config.*`)
- TypeScript build execution
- development autorestart workflow

## Directory structure

```text
packages/cli/
  src/
    index.ts
    cli.ts
    commands/
      dev.ts
      build.ts
      start.ts
    config/
      load-config.ts
      default-config.ts
      config.contract.ts
```

## Key implementation areas

### `src/index.ts`

- executable entrypoint (`#!/usr/bin/env node`)
- forwards to `main()`

### `src/cli.ts`

- parses args
- prints help
- resolves config once
- dispatches selected command

### `src/commands/dev.ts`

- runs app entry through local `tsx/cli` using current Node runtime
- file watching with `chokidar`
- debounced restarts on source changes
- crash restart policy + graceful signal handling

### `src/commands/build.ts`

- uses TypeScript compiler API directly
- resolves and parses `tsconfig.json`
- applies CLI-configured `outDir`
- prints diagnostics and exits non-zero on build errors

### `src/commands/start.ts`

- resolves built entry path from TypeScript `rootDir/outDir` mapping
- supports extension mapping:
  - `.ts/.tsx -> .js`
  - `.mts -> .mjs`
  - `.cts -> .cjs`
- starts process with `process.execPath`

### `src/config/`

- config contract + defaults
- loading strategy:
  1. explicit `--config <path>`
  2. fallback to `trinacria.config.js|cjs|mjs`
  3. defaults
- explicit `--config` with invalid path fails fast

## Runtime flow

1. user runs `trinacria <command>`
2. CLI resolves config
3. command handler runs with normalized config
4. process exits with command outcome

## Extension points for new contributors

- add new command in `src/commands/`
- register command in `src/cli.ts`
- extend config contract in `src/config/config.contract.ts`

## Important design constraints

- keep command handlers independent and testable
- prefer explicit failure messages over silent fallbacks
- avoid shell-specific assumptions when spawning processes
