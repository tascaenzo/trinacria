# API Example: Prisma + PostgreSQL

A minimal API-only example using Trinacria, Prisma, and PostgreSQL.

## Scope

This app is intentionally a base template:
- no authentication (no JWT/session/password flow)
- no authorization roles/policies
- no background jobs

Use this as a starting point for integration examples.

## Endpoints

- `GET /health`
- `GET /users`
- `POST /users`
- `GET /openapi.json`
- `GET /docs` (Swagger UI)

## Built-in middleware enabled

- `requestId`
- `requestLogger`
- `cors`
- `rateLimit`
- `requestTimeout`
- `securityHeaders`

## First steps (local)

1. Install dependencies from the monorepo root:

```bash
npm install
```

2. Copy the environment file:

```bash
cp apps/api-prisma-postgresql/.env.example apps/api-prisma-postgresql/.env.development
```

3. Make sure PostgreSQL is running locally and matches `DATABASE_URL`.

4. Push schema and generate Prisma client:

```bash
npm run prisma:push -w api-prisma-postgresql
npm run prisma:generate -w api-prisma-postgresql
```

5. Start the API:

```bash
npm run dev -w api-prisma-postgresql
```

6. Verify the app is running:

```bash
curl http://127.0.0.1:4001/health
```

## Create your first user

```bash
curl -X POST http://127.0.0.1:4001/users \
  -H 'content-type: application/json' \
  -d '{"name":"Mario Rossi","email":"mario@example.com"}'
```

Then list users:

```bash
curl http://127.0.0.1:4001/users
```

## Docker quick start

1. Create the Docker env file from the same template:

```bash
cp apps/api-prisma-postgresql/.env.example apps/api-prisma-postgresql/.env
```

2. Edit the Docker section in `apps/api-prisma-postgresql/.env` if you want custom credentials/ports.

3. Start PostgreSQL + API using that `.env` file:

```bash
docker compose \
  --env-file apps/api-prisma-postgresql/.env \
  -f apps/api-prisma-postgresql/docker-compose.yml \
  up --build
```

The API will be available at `http://127.0.0.1:${DOCKER_API_PORT}` (default `4001`).

Compose services:
- `postgres`: PostgreSQL 16
- `api`: this Trinacria API (built from this monorepo)

The container startup command automatically runs `prisma db push` before starting the API.
