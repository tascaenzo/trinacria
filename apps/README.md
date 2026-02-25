# Apps Workspace Guide

This folder contains runnable applications used for:
- framework validation
- integration examples
- local manual testing

## App summary

### `playground`

Path: `apps/playground`

Purpose:
- full playground/sandbox for framework features
- includes auth, users module, cron jobs, events, Swagger/OpenAPI
- uses Prisma with SQLite by default

Read more:
- [`apps/playground/README.md`](./playground/README.md)

### `cron-example`

Path: `apps/cron-example`

Purpose:
- minimal app focused on cron scheduling only
- demonstrates interval jobs, cron expression jobs, and overlap guard
- useful as a starting template for background workers

Read more:
- [`apps/cron-example/README.md`](./cron-example/README.md)

### `app-starter`

Path: `apps/app-starter`

Purpose:
- minimal app with only `TrinacriaApp` lifecycle
- no plugins, no modules, no external services
- logs `Hello World` on startup

Read more:
- [`apps/app-starter/README.md`](./app-starter/README.md)

### `api-prisma-postgresql`

Path: `apps/api-prisma-postgresql`

Purpose:
- minimal API-only example for Prisma + PostgreSQL integration
- includes users endpoints, OpenAPI JSON and Swagger UI
- includes Docker setup with PostgreSQL

Read more:
- [`apps/api-prisma-postgresql/README.md`](./api-prisma-postgresql/README.md)

### `api-mongoose-mongodb`

Path: `apps/api-mongoose-mongodb`

Purpose:
- minimal API-only example for Mongoose + MongoDB integration
- includes users endpoints, OpenAPI JSON and Swagger UI
- includes Docker setup with MongoDB

Read more:
- [`apps/api-mongoose-mongodb/README.md`](./api-mongoose-mongodb/README.md)

## Conventions

- Applications in `apps/` are not published npm packages.
- Shared framework/runtime code belongs in `packages/`.
- Each app should include:
  - local setup steps
  - `.env.example`
  - endpoint summary
