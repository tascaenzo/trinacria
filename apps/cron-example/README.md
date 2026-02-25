# Cron Example App

App minimale di esempio per usare `@trinacria/cron`.

Mostra:
- job a intervallo (`interval`)
- job con espressione cron (`cron`)
- protezione overlap con `allowConcurrent: false`
- hook `onError` e `onEvent` del plugin

## Requisiti

- build dei package framework:

```bash
npm run build:packages
```

## Setup

```bash
cp apps/cron-example/.env.example apps/cron-example/.env.development
```

## Avvio

```bash
npm run dev -w cron-example
```

Oppure dalla root:

```bash
npm run dev:cron-example
```

## Docker quick start

1. Crea il file `.env` da template:

```bash
cp apps/cron-example/.env.example apps/cron-example/.env
```

2. Avvia il container:

```bash
docker compose \
  --env-file apps/cron-example/.env \
  -f apps/cron-example/docker-compose.yml \
  up --build -d
```

3. Ferma il container:

```bash
docker compose \
  --env-file apps/cron-example/.env \
  -f apps/cron-example/docker-compose.yml \
  down
```

## Job inclusi

- `cron-example:heartbeat` ogni `HEARTBEAT_INTERVAL_MS` (default `10000`)
- `cron-example:minute-tick` ogni minuto (`* * * * *`)
- `cron-example:overlap-guard-demo` ogni 5 secondi ma con lavoro da 8 secondi per mostrare skip overlap
