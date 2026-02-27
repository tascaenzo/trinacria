# @trinacria/http

`@trinacria/http` is the HTTP plugin for Trinacria.

It provides:

- HTTP server integration with `TrinacriaApp`
- controller routing
- middleware pipeline
- request/response serialization
- optional OpenAPI generation

## Install

```bash
npm i @trinacria/http @trinacria/core
```

## Quick start

```ts
import { TrinacriaApp, createToken, defineModule } from "@trinacria/core";
import { HttpController, createHttpPlugin, httpProvider } from "@trinacria/http";

class HealthController extends HttpController {
  routes() {
    return this.router().get("/health", "health").build();
  }

  health() {
    return { ok: true };
  }
}

const HEALTH = createToken<HealthController>("HEALTH");

const HealthModule = defineModule({
  name: "HealthModule",
  providers: [httpProvider(HEALTH, HealthController)],
  exports: [HEALTH],
});

const app = new TrinacriaApp();
app.use(createHttpPlugin({ port: 4000, host: "127.0.0.1" }));
await app.registerModule(HealthModule);
await app.start();
```

## Built-in middleware

- `requestId`
- `requestLogger`
- `cors`
- `rateLimit`
- `requestTimeout`
- `securityHeaders`

## Links

- Repository: [https://github.com/tascaenzo/trinacria](https://github.com/tascaenzo/trinacria)
- Docs: `docs/en/0002-http-plugin.md`
