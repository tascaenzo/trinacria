# @trinacria/http - Implementation README

This package provides Trinacria's HTTP plugin on top of `node:http`, without Express/Fastify dependencies.

## Goal

- integrate an HTTP server into the Trinacria application lifecycle
- discover controllers via `ProviderKind`
- execute routing + middleware + handlers
- serialize responses and errors consistently

## Directory layout

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
```

### `src/http.plugin.ts`

Plugin orchestration:

- `onInit`: creates `Router`, registers controllers, creates `HttpServer`, starts listening
- `onModuleRegistered`: rebuilds routes by registering all known controllers
- `onModuleUnregistered`: rebuilds routes to remove unloaded module controllers
- `onDestroy`: shuts down server and clears internal state

Plugin options also include:

- `streamingBodyContentTypes?: string[]` to keep selected request bodies as stream (`IncomingMessage`) instead of buffering

### `src/controller/`

- `base-controller.ts`: base class for HTTP controllers
- `http-provider.ts`: `httpProvider(...)` helper to register controllers in DI
- `kind.ts`: `HTTP_CONTROLLER_KIND` for plugin-side discovery

### `src/routing/`

- `route-builder.ts`: DSL used by controllers to define routes
- `route-definition.ts`: route and HTTP method types
- `router.ts`: static/parametric route matching + allowed methods (`405 Allow`), with `clear()` for runtime rebuilds

### `src/middleware/`

Middleware engine only:

- `middleware-definition.ts`: middleware contract `(ctx, next) => Promise`
- `compose.ts`: middleware pipeline composition

### `src/builtin-middlewares/`

Built-in middleware implementations exported by the package:

- `security-headers/`: helmet-like security middleware split by responsibility
- `cors.ts`: CORS headers and preflight handling
- `rate-limit.ts`: in-memory or custom-store rate limiting (`trustProxy` aware)
- `request-id.ts`: request identifier propagation
- `request-logger.ts`: access logging middleware
- `request-timeout.ts`: timeout guard with cooperative abort (`ctx.abort(...)`)

#### `src/builtin-middlewares/security-headers/` (split by responsibility)

- `middleware.ts`: public API (`securityHeaders`, presets, builder) and runtime orchestration
- `types.ts`: public types/options
- `constants.ts`: baseline headers/CSP/presets
- `csp.ts`: CSP merge + compilation (nonce, strict-dynamic, reporting)
- `permissions.ts`: `Permissions-Policy` build/validation
- `report-to.ts`: `Report-To` header serialization
- `validation.ts`: input validation (CSP schema, CRLF, HSTS, etc.)
- `helpers.ts`: runtime helpers (case-insensitive header check, HTTPS detection, rendering)
- `cache.ts`: in-memory cache for static parts (micro-optimization)
- `options.ts`: options clone/merge used by presets and builder
- `index.ts`: local barrel exports

### `src/server/`

Core HTTP runtime:

- `http-server.ts`: request handling, body parsing, route dispatch, response/error write
- `http-executor.ts`: runs global middleware + route middleware + handler
- `http-context.ts`: per-request context shape (`state`, `signal`, `abort`)
- `http-error.ts`: compatibility/deprecation layer

### `src/response/`

- `response-serializer.ts`: default/custom response serializer
- `http-response.ts`: `response(...)` envelope with `status/headers/body`

### `src/errors/`

- typed HTTP exceptions (`BadRequest`, `NotFound`, etc.)
- `exception-handler.ts`: error normalization into HTTP payload

## Request flow (runtime)

1. Request reaches `HttpServer`.
2. Build base `HttpContext` and `AbortController` for the request lifecycle.
3. Router matches `method + path`.
4. If no match:
   - `404` or `405` with `Allow` header.
5. If match:
   - parse body (`application/json` -> JSON, selected streaming types -> request stream, otherwise `Buffer`)
   - execute middleware + handler pipeline via `HttpExecutor`
6. Result goes through response serializer.
7. `HttpServer` writes status/headers/body.
8. On errors: `exceptionHandler` generates a normalized payload.

## Responsibility split (implementation-level)

- `http.plugin.ts`: lifecycle and wiring
- `router.ts`: route resolution only
- `http-server.ts`: HTTP I/O and request control flow
- `http-executor.ts`: middleware/handler orchestration
- `response/*`: output serialization
- `errors/*`: error model and HTTP mapping
- `middleware/*`: middleware engine primitives
- `builtin-middlewares/*`: concrete reusable middleware

## Recommended extension points

- New global middleware: pass it to `createHttpPlugin({ middlewares: [...] })`
- New controller: register with `httpProvider(...)` and implement `routes()`
- Custom error behavior: provide `exceptionHandler`
- Custom output behavior: provide `responseSerializer`
- Custom rate limit storage: provide `rateLimit({ store: yourStore })`

## Design note

Trinacria core stays HTTP-agnostic: this package is an isolated plugin that interprets typed providers and owns all web infrastructure responsibilities.
