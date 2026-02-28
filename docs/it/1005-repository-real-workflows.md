# Repository: Flussi Reali Attivi

Questo documento descrive i flussi realmente presenti nel repository al **27 febbraio 2026**.

## Workflow GitHub Actions attivi

### `CI` (`.github/workflows/ci.yml`)

Trigger:

- `push` su `unstable`, `develop`, `main`
- `pull_request`
- `workflow_dispatch`

Passi:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm run test:packages`
5. su PR: `npx changeset status --since=origin/main`

### `Promotion Branch Tests` (`.github/workflows/promotion-branch-tests.yml`)

Trigger:

- `pull_request` verso `develop` e `main`
- `workflow_dispatch`

Passi:

1. checkout codice della PR
2. `npm ci`
3. `npm run lint`
4. `npm run build`
5. `npm run test:packages`

### `CLI Template Smoke` (`.github/workflows/cli-template-smoke.yml`)

Trigger:

- `pull_request`
- `push` su `main`
- `workflow_dispatch`

Passi:

1. avvio servizi (Postgres, Mongo, Redis, RabbitMQ)
2. `npm ci`
3. `npm run smoke:cli:templates`

### `Docker Smoke` (`.github/workflows/docker-smoke.yml`)

Trigger:

- `pull_request` con modifiche su app Docker o script smoke
- `workflow_dispatch`

Passi:

1. checkout
2. smoke test Docker per 4 app API di esempio

### `Wiki Sync` (`.github/workflows/wiki-sync.yml`)

Trigger:

- `push` su `main` quando cambiano `docs/**` o script wiki
- `workflow_dispatch`

Passi:

1. checkout
2. `scripts/sync-wiki.sh` con `GITHUB_TOKEN`

## Flusso release reale

Nel repository **non e` presente** un workflow GitHub `release.yml` automatico.

La release avviene via script:

- guidata (entrypoint unico): `npm run deploy:npm`
- stabile/prerelease si scelgono nel wizard tramite `tag` (`latest`, `alpha`, `beta`, `rc`)

## Flusso locale pre-commit reale

Hook:

- `.githooks/pre-commit` -> `npm run precommit:check`

Controlli effettivi:

1. ESLint static check sui file staged codice (`*.ts, *.js, ...`)
2. build workspace toccati
3. test workspace toccati
4. se tocchi file globali/script, estende i check ai package `packages/*`

## Note pratiche

- `apps/*` non entrano nel pre-commit build/test automatico (lo script oggi scopre solo `packages/*`).
- Il gate changeset in CI e` basato su `origin/main`.
