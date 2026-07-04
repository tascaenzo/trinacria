# @trinacria/core - Implementation Guide

`@trinacria/core` is the runtime foundation of Trinacria.
It provides the DI container, module graph rules, plugin lifecycle, and application bootstrap/shutdown orchestration.

## What this package is responsible for

- typed dependency injection (`Token`, providers, container)
- module boundaries (`imports`/`exports` visibility)
- plugin lifecycle hooks (`onRegister`, `onInit`, `onDestroy`, runtime module hooks)
- application runtime state and graceful shutdown

It does **not** include HTTP/routing/database concerns.

## Directory structure

```text
packages/core/
  src/
    application/
    di/
    module/
    plugin/
    token/
    logger/
    errors/
    index.ts
```

## Key implementation areas

### `src/application/`

- `trinacria-app.ts`
  - main orchestrator (`TrinacriaApp`)
  - startup pipeline: plugin register -> module build -> container init -> plugin init
  - startup state machine (`idle | starting | started | failed`)
  - runtime module register/unregister with rollback behavior
  - fail-safe shutdown (aggregates errors after cleanup attempt)

- `application-context.ts`
  - API exposed to plugins (`resolve`, `getProvidersByKind`, module ops, graph inspection)

### `src/di/`

- `container.ts`
  - hierarchical container (parent fallback)
  - eager initialization and reverse-order destroy
  - circular dependency detection
  - provider lifecycle hooks (`onInit`, `onDestroy`)
  - failed instantiations are not cached forever (future resolve can retry)
  - provider metadata support:
    - `eager?: boolean`
    - `lifecycle?: "managed" | "external"`

- `provider.ts` / `provider-types.ts`
  - provider factories and contracts (`classProvider`, `factoryProvider`, `valueProvider`)

- `provider-kind.ts`
  - typed capability tag used for plugin-side discovery

### `src/module/`

- `module-registry.ts`
  - builds module containers recursively
  - validates dependency visibility boundaries
  - indexes providers by `ProviderKind`
  - re-exposes exported tokens to root through lazy alias providers
  - preserves singleton identity of exported providers

### `src/plugin/`

- plugin contract + helper (`definePlugin`)

### `src/token/`

- `createToken<T>()` for DI identity keys

### `src/errors/`

- typed runtime/framework errors

## Runtime flow

1. Create `TrinacriaApp`
2. Register plugins/modules/global providers
3. `start()`
   - plugin `onRegister`
   - module graph build
   - container init
   - plugin `onInit`
4. Runtime operations (`resolve`, `registerModule`, `unregisterModule`)
5. `shutdown()`

## Extension points for new contributors

- add new plugin capabilities via `ProviderKind`
- add runtime diagnostics via `ApplicationContext.describeGraph()`
- extend provider semantics in `di/provider-types.ts` + `di/container.ts`
- add module policy checks inside `module/module-registry.ts`

## Important design constraints

- explicit visibility only (no implicit cross-module access)
- plugin model must stay transport-agnostic
- lifecycle ordering must remain deterministic
