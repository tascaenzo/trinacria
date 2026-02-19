# @trinacria/core - Implementation README

This package provides Trinacria's runtime foundation: dependency injection, module graph management, plugin lifecycle orchestration, and application bootstrap/shutdown.

## Goal

- provide a typed DI container with lifecycle hooks
- build and validate module dependency/export boundaries
- orchestrate application and plugin lifecycle
- expose a minimal runtime context for plugins

## Directory layout

```text
packages/core/
  src/
    index.ts
    application/
    di/
    module/
    plugin/
    token/
    logger/
    errors/
```

### `src/index.ts`

Public API barrel for:

- DI (`createToken`, providers, container-facing types)
- module DSL (`defineModule`)
- plugin DSL (`definePlugin`)
- application runtime (`TrinacriaApp`, context/builder contracts)
- logger contracts/implementations
- framework-level error types

### `src/application/`

Application orchestration:

- `trinacria-app.ts`
  - central runtime orchestrator
  - config phase: register plugins/global providers/modules
  - bootstrap phase: plugin `onRegister` -> module graph build -> container init -> plugin `onInit`
  - startup state machine (`idle | starting | started | failed`) to prevent unsafe restart attempts
  - runtime module operations: `registerModule`/`unregisterModule`
  - rollback on runtime registration failures
  - fail-safe shutdown: plugin destroy errors are aggregated, container destroy still runs
  - graceful shutdown and signal handling (`SIGINT`, `SIGTERM`)
- `application-context.ts`
  - public runtime interface exposed to plugins
- `application-builder.ts`
  - setup-time API contract

### `src/di/`

Dependency injection primitives:

- `container.ts`
  - hierarchical container with parent fallback
  - provider registration/unregistration
  - eager initialization (`init`) and reverse-order destruction (`destroy`)
  - circular dependency detection and singleton instance cache
  - failed provider instantiation is not cached forever (future resolve can retry)
  - supports lazy/external-lifecycle provider metadata (`eager`, `lifecycle`)
  - optional provider lifecycle hooks (`onInit`, `onDestroy`) via instance methods
- `provider.ts`
  - provider factory helpers (`classProvider`, `factoryProvider`, `valueProvider`)
  - provider type guards
- `provider-types.ts`
  - provider model contracts
- `provider-kind.ts`
  - typed capability marker used by plugin discovery/indexing

### `src/module/`

Module graph and visibility model:

- `module-definition.ts`
  - declarative module contract (`imports`, `providers`, `exports`)
- `module.ts`
  - typed `defineModule(...)` helper
- `module-registry.ts`
  - builds module containers recursively
  - validates import/export boundaries
  - re-exports selected tokens into root container through lazy aliases
  - preserves singleton identity for exported providers (no duplicate instances)
  - tracks provider kinds for plugin lookup
  - supports runtime unregistration with dependency checks
  - exposes graph diagnostics snapshot (`describeGraph`)

### `src/plugin/`

Plugin lifecycle contract:

- `plugin-lifecycle.ts`
  - `Plugin` interface (`onRegister`, `onInit`, `onModuleRegistered`, `onModuleUnregistered`, `onDestroy`)
- `plugin.ts`
  - `definePlugin(...)` typed helper

### `src/token/`

- typed token model based on unique `Symbol`
- `createToken(...)` helper used as DI keys

### `src/logger/`

- `logger.ts`: base logger contract
- `console-logger.ts`: colored console logger with global level filtering and configurable timestamp locale
- `core-logger.ts`: static facade (`CoreLog`) used by internals

### `src/errors/`

- core typed error hierarchy for lifecycle/DI/module failures
- explicit error classes for deterministic handling and diagnostics

## Runtime flow

1. Create `TrinacriaApp`.
2. Register plugins, global providers, and modules (configuration phase).
3. Call `start()`:
   - plugins `onRegister`
   - module graph build and dependency validation
   - eager DI initialization
   - plugins `onInit`
   - startup enters `failed` state on bootstrap error (create a new app instance to retry)
4. During runtime, modules can be added/removed dynamically.
5. On shutdown/signals, plugin/container errors are aggregated after full cleanup attempt.

## Responsibility split

- `application/*`: lifecycle orchestration and public app runtime
- `di/*`: provider model and instance lifecycle
- `module/*`: module graph and visibility rules
- `plugin/*`: plugin contracts and DSL
- `token/*`: DI identity primitives
- `logger/*`: runtime logging abstraction
- `errors/*`: typed framework error model

## Design notes

- Core is transport-agnostic: no HTTP assumptions.
- Visibility is explicit: exported tokens are visible from root through lazy aliases while keeping module instance identity.
- Plugin integration is capability-driven (`ProviderKind`) instead of tight coupling.
- Runtime module registration includes rollback logic to keep state consistent.
