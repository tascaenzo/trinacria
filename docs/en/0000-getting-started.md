# 🚀 Getting Started (English)

This guide takes you from zero to a working Trinacria API.

End goal:

- run an app with `@trinacria/core` + `@trinacria/http`
- expose `GET /health`
- run `dev`, `build`, `start`

---

# 1) Prerequisites

- Node.js `>= 18`
- npm

Quick check:

```bash
node -v
npm -v
```

---

# 2) Create a new project

```bash
mkdir my-trinacria-app
cd my-trinacria-app
npm init -y
```

Install runtime packages:

```bash
npm i @trinacria/core @trinacria/http @trinacria/schema
```

Install dev tooling:

```bash
npm i -D @trinacria/cli typescript @types/node
```

---

# 3) Recommended minimal structure

```text
my-trinacria-app/
  src/
    main.ts
    modules/
      health/
        health.controller.ts
        health.module.ts
        health.tokens.ts
  tsconfig.json
  trinacria.config.mjs
  package.json
```

---

# 4) Configure `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

# 5) Configure `trinacria.config.mjs`

```js
/** @type {import('@trinacria/cli').TrinacriaConfig} */
export default {
  entry: "src/main.ts",
  outDir: "dist",
  watchDir: "src",
  env: "development",
};
```

---

# 6) Update `package.json` scripts

```json
{
  "scripts": {
    "dev": "trinacria dev",
    "build": "trinacria build",
    "start": "trinacria start"
  }
}
```

---

# 7) Create your first HTTP module

## `src/modules/health/health.tokens.ts`

```ts
import { createToken } from "@trinacria/core";
import { HealthController } from "./health.controller";

export const HEALTH_CONTROLLER =
  createToken<HealthController>("HEALTH_CONTROLLER");
```

## `src/modules/health/health.controller.ts`

```ts
import { HttpController } from "@trinacria/http";

export class HealthController extends HttpController {
  routes() {
    return this.router().get("/health", this.health).build();
  }

  async health() {
    return {
      ok: true,
      service: "my-trinacria-app",
      timestamp: new Date().toISOString(),
    };
  }
}
```

## `src/modules/health/health.module.ts`

```ts
import { defineModule } from "@trinacria/core";
import { httpProvider } from "@trinacria/http";
import { HEALTH_CONTROLLER } from "./health.tokens";
import { HealthController } from "./health.controller";

export const HealthModule = defineModule({
  name: "HealthModule",
  providers: [httpProvider(HEALTH_CONTROLLER, HealthController)],
  exports: [HEALTH_CONTROLLER],
});
```

---

# 8) Create app bootstrap

## `src/main.ts`

```ts
import { TrinacriaApp } from "@trinacria/core";
import { createHttpPlugin } from "@trinacria/http";
import { HealthModule } from "./modules/health/health.module";

async function bootstrap() {
  const app = new TrinacriaApp();

  app.use(
    createHttpPlugin({
      host: "0.0.0.0",
      port: 3000,
    }),
  );

  await app.registerModule(HealthModule);
  await app.start();
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

---

# 9) Start in development

```bash
npm run dev
```

Test endpoint:

```bash
curl http://localhost:3000/health
```

---

# 10) Build and production start

```bash
npm run build
npm run start
```

---

# 11) Next steps

1. Add a `Service` and inject it into controllers with `classProvider(...)`.
2. Organize your domain in modules (`UsersModule`, `AuthModule`, etc.).
3. Add HTTP global middleware (`cors`, `requestId`, `securityHeaders`, `rateLimit`, `requestTimeout`).
4. Use `@trinacria/schema` for type-safe request payload validation.

---

# 12) Common errors

## `Error: Config file not found`

You passed `--config` with an invalid path. Fix the path or remove the flag.

## `Could not find tsconfig.json`

Create a `tsconfig.json` at project root.

## `Built entry file not found`

Check consistency between:

- `trinacria.config.mjs` (`entry`, `outDir`)
- `tsconfig.json` (`rootDir`, `outDir`)

## Port already in use

Change `port` in `createHttpPlugin({ port: ... })` or free the port.

