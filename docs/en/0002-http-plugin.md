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
- `openApi?: { ... }` OpenAPI generation options (disabled by default)

### `openApi` options

- `enabled?: boolean` (default: `false`)
- `jsonPath?: string` (default: `"/openapi.json"`)
- `title: string`
- `version: string`
- `description?: string`
- `transformDocument?: (document) => document`
- `onDocumentGenerated?: (document) => void`

When `openApi.enabled` is `true`, the plugin automatically exposes the generated OpenAPI JSON endpoint (default: `GET /openapi.json`).

## Controllers

To be discovered by the plugin, a controller must be registered with `httpProvider(...)`.
This can be done from module providers or from global providers for cross-cutting routes.

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
.get(path, handlerOrMethodName, { middlewares, docs })
```

`handlerOrMethodName` can be:

- a function `(ctx) => ...`
- a string with the controller method name (`"listUsers"`)

`docs` supports route-level OpenAPI metadata (summary, requestBody, responses, security, tags), so request/response models can be declared next to each route.
You can set `docs.excludeFromOpenApi = true` to keep a route out of the generated specification.

Common use case: keep utility/documentation routes (e.g. `/docs`) outside the OpenAPI JSON while still serving them in the app.

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
- `max?: number` (default `120`)
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

### Built-in middleware reference

#### `requestId(options?)`

Options:

- `headerName?: string` (default: `"x-request-id"`)
- `stateKey?: string` (default: `"requestId"`)
- `generator?: () => string` (default: `crypto.randomUUID`)

Minimal example:

```ts
requestId();
```

Custom header/state key:

```ts
requestId({
  headerName: "x-correlation-id",
  stateKey: "correlationId",
});
```

#### `requestLogger(options?)`

Options:

- `context?: string` (default: `"http:request"`)
- `includeUserAgent?: boolean` (default: `false`)

Minimal example:

```ts
requestLogger();
```

Production example:

```ts
requestLogger({
  context: "api:access",
  includeUserAgent: true,
});
```

#### `cors(options?)`

Options:

- `origin?: "*" | string | RegExp | Array<string | RegExp>` (default: `"*"`)
- `methods?: string[]` (default: `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`)
- `allowedHeaders?: string[]` (default: request `access-control-request-headers`)
- `exposedHeaders?: string[]`
- `credentials?: boolean` (default: `false`)
- `maxAge?: number`
- `optionsSuccessStatus?: number` (default: `204`)

Minimal example:

```ts
cors({ origin: "*" });
```

Production example:

```ts
cors({
  origin: [/\.mycompany\.com$/],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  maxAge: 600,
});
```

#### `rateLimit(options?)`

Options:

- `windowMs?: number` (default: `60_000`)
- `max?: number` (default: `120`)
- `trustProxy?: boolean` (default: `false`)
- `keyGenerator?: (ctx) => string`
- `store?: RateLimitStore` (custom storage backend)

Minimal example:

```ts
rateLimit({ windowMs: 60_000, max: 120 });
```

Production example behind trusted proxy:

```ts
rateLimit({
  windowMs: 60_000,
  max: 240,
  trustProxy: true,
});
```

#### `requestTimeout(options)`

Options:

- `timeoutMs: number` (required, must be `> 0`)
- `errorMessage?: string` (default: `"Request timeout"`)

Minimal example:

```ts
requestTimeout({ timeoutMs: 15_000 });
```

Strict API timeout example:

```ts
requestTimeout({
  timeoutMs: 8_000,
  errorMessage: "Gateway timeout",
});
```

### Ready-to-copy middleware recipes

#### Public API baseline

```ts
middlewares: [
  requestId(),
  requestLogger(),
  cors({ origin: "*" }),
  rateLimit({ windowMs: 60_000, max: 300 }),
  requestTimeout({ timeoutMs: 15_000 }),
  createSecurityHeadersBuilder().preset("development").build(),
]
```

#### API behind reverse proxy (production)

```ts
middlewares: [
  requestId(),
  requestLogger({ includeUserAgent: true }),
  cors({ origin: [/\.mycompany\.com$/], credentials: true, maxAge: 600 }),
  rateLimit({ windowMs: 60_000, max: 240, trustProxy: true }),
  requestTimeout({ timeoutMs: 12_000 }),
  createSecurityHeadersBuilder()
    .preset("production")
    .trustProxy(true)
    .build(),
]
```

#### Protected API (auth-heavy endpoints)

```ts
middlewares: [
  requestId({ headerName: "x-correlation-id", stateKey: "correlationId" }),
  requestLogger({ context: "api:secure", includeUserAgent: true }),
  cors({ origin: "https://app.example.com", credentials: true }),
  rateLimit({ windowMs: 60_000, max: 120, trustProxy: true }),
  requestTimeout({ timeoutMs: 8_000 }),
  createSecurityHeadersBuilder().preset("production").build(),
]
```

### Defaults vs production recommendations

| Middleware | Safe default | Production recommendation |
| --- | --- | --- |
| `requestId` | `x-request-id` generated | Keep request id and propagate to logs/tracing |
| `requestLogger` | basic access log | Enable `includeUserAgent: true`, use explicit context |
| `cors` | permissive (`origin: "*"`) | Restrict origins, enable credentials only if needed |
| `rateLimit` | `60s`, `120 req`, no proxy trust | Tune by endpoint class, set `trustProxy: true` only behind trusted proxy |
| `requestTimeout` | no default unless configured | Always set explicit timeout (`8-15s` typical API range) |
| `securityHeaders` | use env preset | `production` preset + CSP rollout + trusted proxy configuration |

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
