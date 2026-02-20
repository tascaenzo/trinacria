# Plugin HTTP (`@trinacria/http`)

Il plugin HTTP integra un server Node.js nel runtime Trinacria.

Fornisce:

- registrazione controller via `ProviderKind`
- routing con path statici e parametrici (`/users/:id`)
- motore middleware (`compose` + contratto middleware)
- collezione middleware built-in (security, CORS, request id/logging, timeout, rate limit)
- parsing body (JSON + raw fallback)
- serializzazione risposta
- gestione eccezioni HTTP

## Installazione

```bash
npm i @trinacria/http @trinacria/core
```

## Avvio rapido

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

## Opzioni `createHttpPlugin`

- `port?: number` (default: `3000`)
- `host?: string` (default: `0.0.0.0`)
- `middlewares?: HttpMiddleware[]` middleware globali
- `jsonBodyLimitBytes?: number` limite body (default: `1_048_576`)
- `streamingBodyContentTypes?: string[]` content-type da parsare come stream (`IncomingMessage`) invece di `Buffer` (default include `multipart/form-data`, `application/octet-stream`)
- `exceptionHandler?: HttpExceptionHandler` serializer error custom
- `responseSerializer?: HttpResponseSerializer` serializer risposta custom
- `errorSerializer?: HttpServerErrorSerializer` deprecato (usa `exceptionHandler`)

## Controller

Per essere scoperto dal plugin, un controller deve essere registrato con `httpProvider(...)`.

```ts
import { createToken } from "@trinacria/core";
import { httpProvider, HttpController } from "@trinacria/http";

class UserController extends HttpController {
  routes() {
    return this.router()
      .get("/users", this.listUsers)
      .get("/users/:id", this.getById)
      .post("/users", this.create)
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

Metodi supportati:

- `get`, `post`, `put`, `patch`, `delete`, `options`, `head`

Firma:

```ts
.get(path, handlerOrMethodName, ...middlewares)
```

`handlerOrMethodName` può essere:

- una funzione `(ctx) => ...`
- una stringa con il nome del metodo del controller (`"listUsers"`)

## `HttpContext`

Ogni handler/middleware riceve:

- `req`: request raw Node
- `res`: response raw Node
- `params`: parametri path
- `query`: query string (`Record<string, string | string[]>`)
- `body`: body parsato
- `state`: stato condiviso middleware/handler
- `signal`: `AbortSignal` della request (abort su disconnect client/timeout)
- `abort(reason?)`: helper di abort cooperativo

## Middleware

Tipo:

```ts
type HttpMiddleware = (ctx, next) => Promise<unknown>;
```

Esempio:

```ts
const requestLogger = async (ctx, next) => {
  const start = Date.now();
  const result = await next();
  console.log(
    `${ctx.req.method} ${ctx.req.url} -> ${ctx.res.statusCode} (${Date.now() - start}ms)`,
  );
  return result;
};
```

Puoi usarlo:

- globalmente: `createHttpPlugin({ middlewares: [...] })`
- per route: `.post("/users", "create", authMiddleware)`

Architettura middleware:

- `src/middleware`: solo motore middleware (`HttpMiddleware` + composizione)
- `src/builtin-middlewares`: implementazioni middleware built-in esportate dal package

Middleware built-in disponibili:

- `securityHeaders(...)`
- `requestId(...)`
- `requestLogger(...)`
- `cors(...)`
- `rateLimit(...)`
- `requestTimeout(...)`

Opzioni `rateLimit(...)`:

- `windowMs?: number` (default `60_000`)
- `max?: number` (default `120`)
- `keyGenerator?: (ctx) => string`
- `onLimitExceeded?: (ctx) => unknown`
- `trustProxy?: boolean` (default `false`, abilita uso `x-forwarded-for`)
- `store?: RateLimitStore` (backend storage custom)

Esempio baseline del playground:

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

### Riferimento middleware built-in

#### `requestId(options?)`

Opzioni:

- `headerName?: string` (default: `"x-request-id"`)
- `stateKey?: string` (default: `"requestId"`)
- `generator?: () => string` (default: `crypto.randomUUID`)

Esempio minimo:

```ts
requestId();
```

Esempio custom header/state:

```ts
requestId({
  headerName: "x-correlation-id",
  stateKey: "correlationId",
});
```

#### `requestLogger(options?)`

Opzioni:

- `context?: string` (default: `"http:request"`)
- `includeUserAgent?: boolean` (default: `false`)

Esempio minimo:

```ts
requestLogger();
```

Esempio produzione:

```ts
requestLogger({
  context: "api:access",
  includeUserAgent: true,
});
```

#### `cors(options?)`

Opzioni:

- `origin?: "*" | string | RegExp | Array<string | RegExp>` (default: `"*"`)
- `methods?: string[]` (default: `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`)
- `allowedHeaders?: string[]` (default: `access-control-request-headers` della request)
- `exposedHeaders?: string[]`
- `credentials?: boolean` (default: `false`)
- `maxAge?: number`
- `optionsSuccessStatus?: number` (default: `204`)

Esempio minimo:

```ts
cors({ origin: "*" });
```

Esempio produzione:

```ts
cors({
  origin: [/\.mycompany\.com$/],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  maxAge: 600,
});
```

#### `rateLimit(options?)`

Opzioni:

- `windowMs?: number` (default: `60_000`)
- `max?: number` (default: `120`)
- `trustProxy?: boolean` (default: `false`)
- `keyGenerator?: (ctx) => string`
- `store?: RateLimitStore` (backend storage custom)

Esempio minimo:

```ts
rateLimit({ windowMs: 60_000, max: 120 });
```

Esempio produzione dietro proxy trusted:

```ts
rateLimit({
  windowMs: 60_000,
  max: 240,
  trustProxy: true,
});
```

#### `requestTimeout(options)`

Opzioni:

- `timeoutMs: number` (obbligatorio, deve essere `> 0`)
- `errorMessage?: string` (default: `"Request timeout"`)

Esempio minimo:

```ts
requestTimeout({ timeoutMs: 15_000 });
```

Esempio timeout stretto API:

```ts
requestTimeout({
  timeoutMs: 8_000,
  errorMessage: "Gateway timeout",
});
```

### Recipe middleware copy-paste

#### API pubblica baseline

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

#### API dietro reverse proxy (production)

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

#### API protetta (endpoint auth-heavy)

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

### Default vs raccomandazioni production

| Middleware | Default sicuro | Raccomandazione production |
| --- | --- | --- |
| `requestId` | `x-request-id` generato | Mantieni request id e propagalo in log/tracing |
| `requestLogger` | access log base | Abilita `includeUserAgent: true`, usa context esplicito |
| `cors` | permissivo (`origin: "*"`) | Restringi origin, abilita credentials solo se necessario |
| `rateLimit` | `60s`, `120 req`, no trust proxy | Taratura per classi endpoint, `trustProxy: true` solo dietro proxy trusted |
| `requestTimeout` | nessun default se non configurato | Imposta sempre timeout esplicito (`8-15s` tipico API) |
| `securityHeaders` | usa preset ambiente | preset `production` + rollout CSP + config proxy trusted |

### Header di sicurezza (stile Helmet)

`@trinacria/http` espone `securityHeaders()` per applicare header sicuri di default.

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

Preset + builder fluente:

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

Default inclusi (tra gli altri):

- `content-security-policy`
- `strict-transport-security`
- `x-content-type-options`
- `x-frame-options`
- `referrer-policy`
- `permissions-policy`

Personalizzazione:

- `headers`: override/disabilita header singoli (`false` disabilita)
- `contentSecurityPolicy`: direttive, merge intelligente per direttiva (oppure `overrideDirectives: true`), modalita report-only, `report-uri`, `report-to`, supporto nonce (`ctx.state.cspNonce`), `'strict-dynamic'` opzionale, `reportToHeader`, oppure `false`
- `contentSecurityPolicy.schemaValidation`: `"off" | "warn" | "strict"` per validazione schema CSP
- `strictTransportSecurity`: max-age/subdomains/preload oppure `false` (inviato solo su HTTPS)
- `permissionsPolicy`: stringa/oggetto configurabile oppure `false`
- `permissionsPolicyValidation`: `"off" | "warn" | "strict"`
- `crossOriginEmbedderPolicy`: `"require-corp"`, `"unsafe-none"` oppure `false`
- `mode`: `"development" | "staging" | "production"` (default HSTS diversi per ambiente)
- `trustProxy`: se `true`, il rilevamento HTTPS puo usare `x-forwarded-proto`
- preset: `securityHeadersPreset("development" | "staging" | "production" | "enterprise")`
- builder: `createSecurityHeadersBuilder()` per comporre config in modo sicuro

### Requisiti Production

- Esegui il servizio dietro HTTPS (terminazione TLS su edge/proxy va bene).
- Imposta `trustProxy: true` solo se `x-forwarded-proto` e inserito da un reverse proxy trusted.
- Abilita preload HSTS solo quando la strategia dominio/subdomini e pronta per preload.
- Se usi CSP `report-to`, configura sia la direttiva (`reportTo`) sia l'header HTTP `Report-To` (`reportToHeader`).
- Parti da CSP report-only in rollout graduale, poi passa a enforcement.

## Body parsing

Comportamento server:

- nessun body: `ctx.body = undefined`
- `content-type: application/json`: parse JSON
- content-type che matchano `streamingBodyContentTypes`: stream raw request (`IncomingMessage`)
- altri content-type: `Buffer`
- JSON invalido: `400 BadRequestException`
- payload oltre limite: `413 PayloadTooLargeException`

## Risposte

Return dal controller:

- `string`: `text/plain; charset=utf-8`
- `Buffer`/`Uint8Array`/`Readable`: `application/octet-stream`
- oggetto/array: JSON
- `undefined`: response vuota

Per controllare status/header usa `response(...)`:

```ts
import { response } from "@trinacria/http";

return response(
  { ok: true },
  { status: 201, headers: { location: "/users/123" } },
);
```

## Error handling

Eccezioni pronte:

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

Puoi personalizzare la serializzazione errori con `exceptionHandler`.

## Lifecycle plugin

- `onInit`: crea router/server, registra route e avvia listener
- `onModuleRegistered`: ricostruisce le route includendo moduli aggiunti a runtime
- `onModuleUnregistered`: ricostruisce le route rimuovendo controller di moduli scaricati
- `onDestroy`: chiude server e connessioni

## Note operative

- Se una route non esiste: `404`
- Se path esiste ma metodo non consentito: `405` + header `Allow`
- `HEAD` non invia body (anche in caso di errore)
