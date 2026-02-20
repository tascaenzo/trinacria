# 🚀 Getting Started (Italiano)

Questa guida ti porta da zero a una prima API funzionante con Trinacria.

Obiettivo finale:

- avviare un'app con `@trinacria/core` + `@trinacria/http`
- esporre un endpoint `GET /health`
- eseguire `dev`, `build`, `start`

---

# 1) Prerequisiti

- Node.js `>= 18`
- npm

Controllo rapido:

```bash
node -v
npm -v
```

---

# 2) Crea un nuovo progetto

```bash
mkdir my-trinacria-app
cd my-trinacria-app
npm init -y
```

Installa i pacchetti runtime:

```bash
npm i @trinacria/core @trinacria/http @trinacria/schema
```

Installa strumenti dev:

```bash
npm i -D @trinacria/cli typescript @types/node
```

---

# 3) Struttura minima consigliata

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

# 4) Configura `tsconfig.json`

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

# 5) Configura `trinacria.config.mjs`

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

# 6) Aggiorna script in `package.json`

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

# 7) Crea il primo modulo HTTP

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

# 8) Crea il bootstrap app

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

# 9) Avvia in sviluppo

```bash
npm run dev
```

Test endpoint:

```bash
curl http://localhost:3000/health
```

---

# 10) Build e start produzione

```bash
npm run build
npm run start
```

---

# 11) Prossimi passi

1. Aggiungi un `Service` e iniettalo nel controller con `classProvider(...)`.
2. Organizza il dominio in moduli (`UsersModule`, `AuthModule`, ecc.).
3. Aggiungi middleware globali HTTP (`cors`, `requestId`, `securityHeaders`, `rateLimit`, `requestTimeout`).
4. Usa `@trinacria/schema` per validare payload request in modo type-safe.

---

# 12) Errori comuni

## `Error: Config file not found`

Hai passato `--config` con path non valido. Correggi il path o rimuovi il flag.

## `Could not find tsconfig.json`

Crea `tsconfig.json` nella root progetto.

## `Built entry file not found`

Controlla coerenza tra:

- `trinacria.config.mjs` (`entry`, `outDir`)
- `tsconfig.json` (`rootDir`, `outDir`)

## Porta già in uso

Cambia `port` nel `createHttpPlugin({ port: ... })` o libera la porta.

