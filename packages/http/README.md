# @trinacria/http - Implementation Guide

`@trinacria/http` is Trinacria's HTTP plugin built on `node:http`.
It wires controllers, routing, middleware execution, body parsing, and HTTP response/error serialization.

## What this package is responsible for

- HTTP server lifecycle integration into `TrinacriaApp`
- controller discovery through `ProviderKind`
- route matching and method handling (`404`/`405` + `Allow`)
- global + route middleware pipeline
- request body parsing, response serialization, exception mapping

## Directory structure

```text
packages/http/
  src/
    http.plugin.ts
    controller/
    routing/
    middleware/
    builtin-middlewares/
      security-headers/
    server/
    response/
    errors/
    index.ts
```

## Key implementation areas

### `src/http.plugin.ts`

- plugin entrypoint (`createHttpPlugin`)
- creates router + server on init
- rebuilds routes on runtime module register/unregister
- exposes config for host/port/body parsing/middleware stack
- can generate OpenAPI documents from route metadata through `openApi` options (disabled by default)
- automatically exposes OpenAPI JSON endpoint when `openApi.enabled=true` (default path: `/openapi.json`, configurable with `openApi.jsonPath`)

### `src/controller/`

- `HttpController` base class
- `httpProvider(...)` helper for DI registration
- controller discovery kind (`HTTP_CONTROLLER_KIND`)

### `src/routing/`

- route builder DSL (`.get()`, `.post()`, ...)
- static/parametric matching
- allowed-method discovery for `405`
- route-level docs metadata (`docs`) for OpenAPI request/response/security details
  - includes `docs.excludeFromOpenApi` to keep specific routes out of generated docs

### `src/middleware/`

- middleware engine primitives only:
  - `HttpMiddleware` contract
  - `compose(...)`

### `src/builtin-middlewares/`

Reusable implementations shipped by the package:

- `securityHeaders(...)`
- `requestId(...)`
- `requestLogger(...)`
- `cors(...)`
- `rateLimit(...)`
- `requestTimeout(...)`

`security-headers/` is split by responsibility (`csp`, `validation`, `helpers`, `report-to`, presets, builder).

### `src/server/`

- `http-server.ts`
  - request lifecycle
  - body parsing (`json` / stream content-types / buffer fallback)
  - request abort integration (`ctx.signal`, `ctx.abort`)

- `http-executor.ts`
  - middleware + handler execution pipeline

### `src/response/` and `src/errors/`

- typed HTTP exception model
- default/custom serializer hooks

## Runtime request flow

1. Node request arrives
2. create base `HttpContext`
3. router match
4. parse body
5. execute middleware + handler
6. serialize/write response
7. normalize exceptions when needed

## Extension points for new contributors

- new built-in middleware in `src/builtin-middlewares/`
- new router capabilities in `src/routing/`
- alternative serializers in `src/response/`
- error policy extension in `src/errors/exception-handler.ts`

## Important design constraints

- keep middleware engine (`src/middleware`) framework-agnostic
- keep built-ins in `src/builtin-middlewares`
- preserve case-insensitive header behavior and proxy trust semantics
