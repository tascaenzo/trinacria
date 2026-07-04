# App Starter

A minimal Trinacria app with only `TrinacriaApp` bootstrap and a `Hello World` log.

This template does not include:

- plugins
- modules
- database
- HTTP API

## Start

```bash
npm run dev
```

## Docker quick start

```bash
docker compose \
  -f docker-compose.yml \
  up --build -d
```

To stop:

```bash
docker compose \
  -f docker-compose.yml \
  down
```
