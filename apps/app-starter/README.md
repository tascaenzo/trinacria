# App Starter

App minima: solo bootstrap di `TrinacriaApp` e log `Hello World`.

Non include:
- plugin
- moduli
- database
- API HTTP

## Avvio

```bash
npm run dev -w app-starter
```

Oppure dalla root:

```bash
npm run dev:app-starter
```

## Docker quick start

```bash
docker compose \
  -f apps/app-starter/docker-compose.yml \
  up --build -d
```

Per fermare:

```bash
docker compose \
  -f apps/app-starter/docker-compose.yml \
  down
```
