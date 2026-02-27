# API Example: RabbitMQ Events

A minimal API-only example using Trinacria Events with RabbitMQ transport.

## Scope

This app is intentionally a base template:

- no authentication (no JWT/session/password flow)
- no authorization roles/policies
- no database persistence for domain data
- focus only on event publish/consume flow via RabbitMQ

## Endpoints

- `GET /health`
- `GET /events`
- `POST /events/publish`
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
cp apps/api-events-rabbitmq/.env.example apps/api-events-rabbitmq/.env.development
```

3. Make sure RabbitMQ is running locally and matches `RABBITMQ_URL`.

4. Start the API:

```bash
npm run dev -w api-events-rabbitmq
```

5. Verify the app is running:

```bash
curl http://127.0.0.1:4004/health
```

## Publish your first event

```bash
curl -X POST http://127.0.0.1:4004/events/publish \
  -H 'content-type: application/json' \
  -d '{"message":"hello rabbitmq events"}'
```

Then list consumed events:

```bash
curl http://127.0.0.1:4004/events
```

## Docker quick start

1. Create the Docker env file from the same template:

```bash
cp apps/api-events-rabbitmq/.env.example apps/api-events-rabbitmq/.env
```

2. Edit the Docker section in `apps/api-events-rabbitmq/.env` if you want custom RabbitMQ ports/queue setup.

3. Start RabbitMQ + API using that `.env` file:

```bash
docker compose \
  --env-file apps/api-events-rabbitmq/.env \
  -f apps/api-events-rabbitmq/docker-compose.yml \
  up --build
```

The API will be available at `http://127.0.0.1:${DOCKER_API_PORT}` (default `4004`).

Compose services:

- `rabbitmq`: RabbitMQ 3 (management image)
- `api`: this Trinacria API
