# Playground App (Trinacria)

## Purpose

This app exists to **test, validate, and demonstrate** the Trinacria framework in a realistic but controlled environment.

It is not a final business application: it is a sandbox used to verify runtime behavior, DI, HTTP plugin behavior, middleware, schema validation, authentication, and database integration.

## What It Includes Today

- Trinacria bootstrap with the HTTP plugin (`@trinacria/http`).
- Runtime config validated from env (`src/global-service/app-config.service.ts`).
- Global infrastructure providers (config + Prisma).
- `auth` module with JWT (`jose`), HttpOnly cookies, refresh token flow, CSRF middleware.
- `users` module with protected CRUD endpoints.
- Prisma + SQLite for local testing.

## Applied Architecture Philosophy

The playground follows framework principles:

- **Core remains agnostic**: no domain logic in core.
- **Explicit modules**: domain logic lives in `src/modules/*`.
- **Global infrastructure**: shared providers live in `src/global-service/*`.
- **Typed dependencies**: DI tokens, no reflection/magic.
- **Composable middleware**: security and auth are explicit pipeline steps.

## Directory Structure

- `src/main.ts`
  - app bootstrap, HTTP plugin config, global middleware setup, module registration.
- `src/global-service/`
  - global infrastructure services (env config + Prisma provider/token).
- `src/global-controller/`
  - global HTTP controllers for cross-cutting routes (e.g. Swagger docs UI).
- `src/modules/auth/`
  - login/refresh/logout/me, JWT guards, CSRF, cookie utilities.
- `src/modules/users/`
  - user endpoints and domain service.
- `prisma/schema.prisma`
  - SQLite schema (`User`, `AuthSession`).

## Global Providers

Currently registered globally in `src/main.ts`:

- `APP_CONFIG`
- `PRISMA_SERVICE`
- `SWAGGER_DOCS_CONTROLLER` (only when `OPENAPI_ENABLED=true`)

This is the recommended convention for cross-cutting infrastructure (config, db, logger, metrics).

## Auth Flow (High Level)

1. `POST /auth/login` validates credentials and creates a session.
2. Returns cookies (`access`, `refresh`, `csrf`) and response payload.
3. `AuthGuardFactory.requireAuth()` reads token from cookie first, then Bearer header.
4. `AuthGuardFactory.requireCsrf()` protects mutating endpoints.
5. `POST /auth/refresh` rotates session/tokens.
6. `POST /auth/logout` revokes session and clears cookies.

## Security Middleware Already In Use

Configured in `src/main.ts`:

- `requestId`
- `requestLogger`
- `cors` (with credentials)
- `rateLimit`
- `requestTimeout`
- `securityHeaders`

The auth module also includes dedicated rate limits for sensitive endpoints.

## Quick Local Setup

1. Install root dependencies:

```bash
npm install
```

2. Sync SQLite schema:

```bash
npm run prisma:push -w playground -- --skip-generate
```

3. Generate Prisma client (if needed):

```bash
npm run prisma:generate -w playground
```

4. Start in dev mode:

```bash
npm run dev -w playground
```

## Main Environment Variables

Local file: `.env.development`.

Relevant fields:

- `HOST`
- `PORT`
- `DATABASE_URL` (e.g. `file:./dev.db`)
- `NODE_ENV` (`development|staging|production`)
- `TRUST_PROXY`
- `OPENAPI_ENABLED` (`true|false`, default `false`)
- `SWAGGER_DOCS_USERNAME` (optional, requires `SWAGGER_DOCS_PASSWORD`)
- `SWAGGER_DOCS_PASSWORD` (optional, requires `SWAGGER_DOCS_USERNAME`)
- `CORS_ALLOWED_ORIGINS`
- `JWT_SECRET`
- `JWT_ACCESS_TOKEN_TTL_SECONDS`
- `JWT_REFRESH_TOKEN_TTL_SECONDS`
- `AUTH_COOKIE_DOMAIN`

In production, config applies stricter validation (e.g. `JWT_SECRET` is required and must be strong).

## Main Endpoints

- `GET /openapi.json` (available when `OPENAPI_ENABLED=true`)
- `GET /docs` (available when `OPENAPI_ENABLED=true`)
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /users`
- `GET /users/:id`
- `POST /users`
- `PUT /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

## OpenAPI and Docs

- The OpenAPI JSON is generated directly by `@trinacria/http` when `openApi.enabled=true` in `createHttpPlugin(...)`.
- In this app, `OPENAPI_ENABLED=true` enables:
  - generated spec endpoint: `GET /openapi.json`
  - Swagger UI endpoint: `GET /docs`
- `/docs` is intentionally excluded from the generated OpenAPI spec.

### Protecting `/docs` with Basic Auth

Set both environment variables together:

- `SWAGGER_DOCS_USERNAME`
- `SWAGGER_DOCS_PASSWORD`

If both are configured, `/docs` requires HTTP Basic authentication.
If only one is configured, startup fails with config validation error.

## Conventions For Contributors

- Use global providers for shared infrastructure.
- Keep domain logic inside modules.
- Do not introduce implicit module coupling: always use token/export/import boundaries.
- Keep auth/security middleware explicit on sensitive routes.
- Update this file whenever flows, modules, or security policies change.

## Current Status and Limits

The playground is framework-oriented and intentionally simplified in some areas compared to a full enterprise product. Before using the same setup in production, add further hardening (audit, persistence policies, secret management, advanced observability, deeper security testing).
