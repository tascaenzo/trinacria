# Repository: Real Active Workflows

This document describes the workflows that are actually active in the repository as of **February 27, 2026**.

## Active GitHub Actions workflows

### `CI` (`.github/workflows/ci.yml`)

Triggers:

- `push` on `unstable`, `develop`, `main`
- `pull_request`
- `workflow_dispatch`

Steps:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm run test:packages`
5. on PR: `npx changeset status --since=origin/main`

### `Promotion Branch Tests` (`.github/workflows/promotion-branch-tests.yml`)

Triggers:

- `pull_request` targeting `develop` and `main`
- `workflow_dispatch`

Steps:

1. checkout PR code
2. `npm ci`
3. `npm run lint`
4. `npm run build`
5. `npm run test:packages`

### `CLI Template Smoke` (`.github/workflows/cli-template-smoke.yml`)

Triggers:

- `pull_request`
- `push` on `main`
- `workflow_dispatch`

Steps:

1. start services (Postgres, Mongo, Redis, RabbitMQ)
2. `npm ci`
3. `npm run smoke:cli:templates`

### `Docker Smoke` (`.github/workflows/docker-smoke.yml`)

Triggers:

- `pull_request` touching Docker example apps or smoke script
- `workflow_dispatch`

Steps:

1. checkout
2. docker smoke tests for 4 sample API apps

### `Wiki Sync` (`.github/workflows/wiki-sync.yml`)

Triggers:

- `push` on `main` when `docs/**` or wiki script changes
- `workflow_dispatch`

Steps:

1. checkout
2. run `scripts/sync-wiki.sh` with `GITHUB_TOKEN`

## Real release flow

There is **no automatic** GitHub `release.yml` workflow in this repository.

Releases are currently script-driven:

- guided (single entrypoint): `npm run deploy:npm`
- stable/prerelease are selected inside the wizard via `tag` (`latest`, `alpha`, `beta`, `rc`)

## Real local pre-commit flow

Hook:

- `.githooks/pre-commit` -> `npm run precommit:check`

Current checks:

1. ESLint static check on staged code files (`*.ts, *.js, ...`)
2. build for touched workspaces
3. test for touched workspaces
4. when global/script files change, checks expand across `packages/*`

## Practical notes

- `apps/*` are not auto-discovered by pre-commit build/test (script currently discovers only `packages/*`).
- CI changeset gate is based on `origin/main`.
