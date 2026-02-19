# HTTP Plugin (`@trinacria/http`)

The HTTP plugin integrates a Node.js server into the Trinacria runtime.

It provides:

- controller registration through `ProviderKind`
- routing with static and parametric paths (`/users/:id`)
- middleware engine (`compose` + middleware contracts)
- built-in middleware collection (security, CORS, request id/logging, timeout, rate limit)
- request body parsing (JSON + raw fallback)
- response serialization
- HTTP exception handling

## Installation

```bash
npm i @trinacria/http @trinacria/core
```

## Quick start

```ts
import { TrinacriaApp } from "@trinacria/core";
import { createHttpPlugin } from "@trinacria/http";
import { UserModule } from "./modules/users/user.module";

const app = new TrinacriaApp();

app.use(
  createHttpPlugin({
    port: 5000,
    host: "0.0.0.0",
  }),
);

await app.registerModule(UserModule);
await app.start();
```

## `createHttpPlugin` options

- `port?: number` (default: `3000`)
- `host?: string` (default: `0.0.0.0`)
- `middlewares?: HttpMiddleware[]` global middleware
- `jsonBodyLimitBytes?: number` body limit (default: `1_048_576`)
- `streamingBodyContentTypes?: string[]` content-types parsed as stream (`IncomingMessage`) instead of `Buffer` (default includes `multipart/form-data`, `application/octet-stream`)
- `exceptionHandler?: HttpExceptionHandler` custom error serializer
- `responseSerializer?: HttpResponseSerializer` custom response serializer
- `errorSerializer?: HttpServerErrorSerializer` deprecated (use `exceptionHandler`)

## Controllers

To be discovered by the plugin, a controller must be registered with `httpProvider(...)`.

```ts
import { createToken } from "@trinacria/core";
import { httpProvider, HttpController } from "@trinacria/http";

class UserController extends HttpController {
  routes() {
    return this.router()
      .get("/users", "listUsers")
      .get("/users/:id", "getById")
      .post("/users", "create")
      .build();
  }

  async listUsers() {
    return [{ id: "1", name: "Mario" }];
  }

  async getById(ctx) {
    return { id: ctx.params.id };
  }

  async create(ctx) {
    return { created: true, body: ctx.body };
  }
}

const USER_CONTROLLER = createToken<UserController>("USER_CONTROLLER");

export const userControllerProvider = httpProvider(
  USER_CONTROLLER,
  UserController,
  [],
);
```

## RouteBuilder

Supported methods:

- `get`, `post`, `put`, `patch`, `delete`, `options`, `head`

Signature:

```ts
.get(path, handlerOrMethodName, ...middlewares)
```

`handlerOrMethodName` can be:

- a function `(ctx) => ...`
- a string with the controller method name (`"listUsers"`)

## `HttpContext`

Each handler/middleware receives:

- `req`: raw Node request
- `res`: raw Node response
- `params`: path params
- `query`: query string (`Record<string, string | string[]>`)
- `body`: parsed body
- `state`: shared state for middleware/handlers
- `signal`: request `AbortSignal` (aborts on client disconnect/timeout)
- `abort(reason?)`: abort helper for cooperative cancellation

## Middleware

Type:

```ts
type HttpMiddleware = (ctx, next) => Promise<unknown>;
```

Example:

```ts
const requestLogger = async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  console.log(`${ctx.req.method} ${ctx.req.url} -> ${ctx.res.statusCode} (${Date.now() - start}ms)`);
  return result;
};
```

You can use middleware:

- globally: `createHttpPlugin({ middlewares: [...] })`
- per route: `.post("/users", "create", authMiddleware)`

Middleware architecture:

- `src/middleware`: middleware engine only (`HttpMiddleware` contract + composition)
- `src/builtin-middlewares`: built-in middleware implementations exported by the package

Built-in middleware:

- `securityHeaders(...)`
- `requestId(...)`
- `requestLogger(...)`
- `cors(...)`
- `rateLimit(...)`
- `requestTimeout(...)`

`rateLimit(...)` options:

- `windowMs?: number` (default `60_000`)
- `max?: number` (default `100`)
- `keyGenerator?: (ctx) => string`
- `onLimitExceeded?: (ctx) => unknown`
- `trustProxy?: boolean` (default `false`, enables `x-forwarded-for` usage)
- `store?: RateLimitStore` (custom storage backend)

Playground baseline example:

```ts
import {
  cors,
  createHttpPlugin,
  createSecurityHeadersBuilder,
  rateLimit,
  requestId,
  requestLogger,
  requestTimeout,
} from "@trinacria/http";

const security = createSecurityHeadersBuilder().preset("development").build();

app.use(
  createHttpPlugin({
    middlewares: [
      requestId(),
      requestLogger(),
      cors({ origin: "*" }),
      rateLimit({ windowMs: 60_000, max: 2000, trustProxy: true }),
      requestTimeout({ timeoutMs: 15_000 }),
      security,
    ],
  }),
);
```

### Security headers (Helmet-like)

`@trinacria/http` exposes `securityHeaders()` to apply secure default headers.

```ts
import { createHttpPlugin, securityHeaders } from "@trinacria/http";

app.use(
  createHttpPlugin({
    middlewares: [
      securityHeaders({
        mode: "production",
        contentSecurityPolicy: {
          nonce: true,
          reportTo: "csp-endpoint",
        },
        permissionsPolicy: {
          camera: [],
          microphone: [],
          geolocation: [],
        },
        crossOriginEmbedderPolicy: "require-corp",
      }),
    ],
  }),
);
```

Preset + fluent builder:

```ts
import { createSecurityHeadersBuilder } from "@trinacria/http";

const security = createSecurityHeadersBuilder()
  .preset("production")
  .contentSecurityPolicy({
    nonce: true,
    addStrictDynamicWhenNonce: true,
  })
  .build();
```

Defaults include headers like:

- `content-security-policy`
- `strict-transport-security`
- `x-content-type-options`
- `x-frame-options`
- `referrer-policy`
- `permissions-policy`

Customization:

- `headers`: override/disable single headers (`false` disables one)
- `contentSecurityPolicy`: directives, smart merge by directive (or `overrideDirectives: true`), report-only mode, `report-uri`, `report-to`, nonce support (`ctx.state.cspNonce`), optional `'strict-dynamic'`, `reportToHeader`, or `false`
- `contentSecurityPolicy.schemaValidation`: `"off" | "warn" | "strict"` for CSP schema checks
- `strictTransportSecurity`: max age/subdomains/preload or `false` (sent only on HTTPS)
- `permissionsPolicy`: string/object config or `false`
- `permissionsPolicyValidation`: `"off" | "warn" | "strict"`
- `crossOriginEmbedderPolicy`: `"require-corp"`, `"unsafe-none"` or `false`
- `mode`: `"development" | "staging" | "production"` (HSTS defaults vary by env)
- `trustProxy`: if `true`, HTTPS detection may use `x-forwarded-proto`
- presets: `securityHeadersPreset("development" | "staging" | "production" | "enterprise")`
- builder: `createSecurityHeadersBuilder()` for safer team-wide config composition

### Production Requirements

- Run behind HTTPS (TLS termination at edge/proxy is fine).
- Set `trustProxy: true` only when `x-forwarded-proto` is set by a trusted reverse proxy.
- Enable HSTS preload only when your full domain strategy is preload-ready.
- If using CSP `report-to`, configure both directive (`reportTo`) and HTTP `Report-To` header (`reportToHeader`).
- Start with report-only CSP in staged rollouts, then enforce.

## Body parsing

Server behavior:

- no body: `ctx.body = undefined`
- `content-type: application/json`: JSON parse
- content-type matching `streamingBodyContentTypes`: raw request stream (`IncomingMessage`)
- other content types: `Buffer`
- invalid JSON: `400 BadRequestException`
- payload above limit: `413 PayloadTooLargeException`

## Responses

Controller return values:

- `string`: `text/plain; charset=utf-8`
- `Buffer`/`Uint8Array`/`Readable`: `application/octet-stream`
- object/array: JSON
- `undefined`: empty response

To control status/headers, use `response(...)`:

```ts
import { response } from "@trinacria/http";

return response({ ok: true }, { status: 201, headers: { location: "/users/123" } });
```

## Error handling

Built-in exceptions:

- `BadRequestException` (400)
- `UnauthorizedException` (401)
- `ForbiddenException` (403)
- `NotFoundException` (404)
- `MethodNotAllowedException` (405)
- `ConflictException` (409)
- `PayloadTooLargeException` (413)
- `UnprocessableEntityException` (422)
- `TooManyRequestsException` (429)
- `InternalServerErrorException` (500)
- `ServiceUnavailableException` (503)

You can customize error serialization using `exceptionHandler`.

## Plugin lifecycle

- `onInit`: creates router/server, registers routes, starts listener
- `onModuleRegistered`: rebuilds routes including modules added at runtime
- `onModuleUnregistered`: rebuilds routes removing unloaded module controllers
- `onDestroy`: closes server and connections

## Operational notes

- Missing route: `404`
- Path exists but method not allowed: `405` + `Allow` header
- `HEAD` does not send a body (also for errors)
