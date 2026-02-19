# @trinacria/cli - Implementation README

This package provides the `trinacria` command-line interface used to run apps in development, build TypeScript output, and start production bundles.

## Goal

- provide a minimal developer workflow (`dev`, `build`, `start`)
- load project config with sane defaults
- keep command orchestration independent from application business logic

## Directory layout

```text
packages/cli/
  src/
    index.ts
    cli.ts
    commands/
    config/
```

### `src/index.ts`

CLI entrypoint:

- includes shebang (`#!/usr/bin/env node`)
- re-exports `TrinacriaConfig` type
- delegates to `main()` in `cli.ts`

### `src/cli.ts`

Command router:

- parses argv
- prints help for missing/unknown commands
- loads config once via `loadConfig(...)`
- dispatches commands:
  - `dev`
  - `build`
  - `start`
- handles top-level errors with non-zero exit code

### `src/commands/`

Command implementations:

- `dev.ts`
  - starts app with `tsx <entry>` child process
  - watches source directory via `chokidar`
  - debounced restart on file changes
  - restart on crash (except configured non-restartable exit codes)
  - graceful child termination on CLI signals
- `build.ts`
  - compiles using TypeScript compiler API
  - reads nearest `tsconfig.json`
  - applies `outDir` from CLI config
  - prints diagnostics and exits non-zero on errors
- `start.ts`
  - runs compiled app with `node <outDir>/<entry>.js`
  - intended for production mode

### `src/config/`

Configuration loading layer:

- `config.contract.ts`
  - `ResolvedConfig` and user-facing `TrinacriaConfig`
- `default-config.ts`
  - baseline defaults (`entry`, `outDir`, `watchDir`, `env`)
- `load-config.ts`
  - resolves config from:
    - `--config <path>`
    - fallback files in cwd (`trinacria.config.js|cjs|mjs`)
  - supports CJS first, then ESM fallback via dynamic import
  - merges user config on top of defaults

## Runtime flow

1. User runs `trinacria <command> [--config ...]`.
2. `main()` resolves config.
3. Command handler executes with normalized config.
4. Process exit code reflects command result.

## Responsibility split

- `cli.ts`: argument parsing and command dispatch
- `commands/*`: command-specific runtime behavior
- `config/*`: configuration discovery/loading/normalization

## Design notes

- CLI reuses `@trinacria/core` logger for consistent output style.
- `dev` mode prioritizes fast feedback and deterministic restarts.
- `build` mode avoids shelling out to `tsc` and uses TS API directly.
- `start` assumes build artifacts are already generated.
