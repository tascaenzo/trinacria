# Plugin HTTP (`@trinacria/http`)

Il plugin HTTP integra un server Node.js nel runtime Trinacria.

Fornisce:

- registrazione controller via `ProviderKind`
- routing con path statici e parametrici (`/users/:id`)
- middleware globali e per-route
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

## Body parsing

Comportamento server:

- nessun body: `ctx.body = undefined`
- `content-type: application/json`: parse JSON
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
- `onModuleRegistered`: registra controller di moduli aggiunti a runtime
- `onDestroy`: chiude server e connessioni

## Note operative

- Se una route non esiste: `404`
- Se path esiste ma metodo non consentito: `405` + header `Allow`
- `HEAD` non invia body (anche in caso di errore)
