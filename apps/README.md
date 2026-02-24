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
