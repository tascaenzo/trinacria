# API Example: Mongoose + MongoDB

A minimal API-only example using Trinacria, Mongoose, and MongoDB.

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
cp apps/api-mongoose-mongodb/.env.example apps/api-mongoose-mongodb/.env.development
```

3. Make sure MongoDB is running locally and matches `DATABASE_URL`.

4. Start the API:

```bash
npm run dev -w api-mongoose-mongodb
```

5. Verify the app is running:

```bash
curl http://127.0.0.1:4002/health
```

## Create your first user

```bash
curl -X POST http://127.0.0.1:4002/users \
  -H 'content-type: application/json' \
  -d '{"name":"Mario Rossi","email":"mario@example.com"}'
```

Then list users:

```bash
curl http://127.0.0.1:4002/users
```

## Docker quick start

1. Create the Docker env file from the same template:

```bash
cp apps/api-mongoose-mongodb/.env.example apps/api-mongoose-mongodb/.env
```

2. Edit the Docker section in `apps/api-mongoose-mongodb/.env` if you want custom DB name/ports.

3. Start MongoDB + API using that `.env` file:

```bash
docker compose \
  --env-file apps/api-mongoose-mongodb/.env \
  -f apps/api-mongoose-mongodb/docker-compose.yml \
  up --build
```

The API will be available at `http://127.0.0.1:${DOCKER_API_PORT}` (default `4002`).

Compose services:

- `mongo`: MongoDB 7
- `api`: this Trinacria API (built from this monorepo)
