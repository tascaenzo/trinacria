# Repository Release Scripts and Workflows (Practical Guide)

This guide explains, in practical terms, the npm scripts for versioning/release and the GitHub Actions workflows configured in this repository.

## Available scripts

Defined in root `package.json`:

- `npm run changeset`
- `npm run changeset:status`
- `npm run version-packages`
- `npm run release`
- `npm run precommit:check`
- `npm run hooks:install`

## What each script does

### `npm run changeset`

Interactive Changesets command.

It creates a markdown file in `.changeset/` that describes:

- changed package(s) (`@trinacria/core`, `@trinacria/http`, etc.)
- bump type (`patch`, `minor`, `major`)
- release/changelog note

When to use it:

- every time a PR changes behavior/API of published packages.

Expected output:

- a new file like `.changeset/your-message.md` to commit with code changes.

### `npm run changeset:status`

Shows pending changesets and resulting version updates.

When to use it:

- before merge/release to check if a changeset is missing
- in CI to enforce release-flow quality

### `npm run version-packages`

Runs `changeset version`.

What it does:

- reads `.changeset/` files
- updates affected package versions
- updates internal dependency ranges according to `updateInternalDependencies`
- creates/updates package `CHANGELOG.md` files
- consumes used changesets (removes them)

When to use it:

- in the automated release PR flow
- locally only when you want to simulate release-PR output

### `npm run release`

Runs `changeset publish`.

What it does:

- publishes newly versioned packages to npm
- creates release tags

When to use it:

- in the `Release` workflow on `main` (not on feature branches)

Prerequisites:

- npm token configured (`NPM_TOKEN`) in GitHub Actions secrets
- packages configured for publishing

### `npm run precommit:check`

Runs `node scripts/pre-commit.mjs`.

What it does:

- detects touched workspaces from staged files
- runs `build` for touched workspaces (if `build` script exists)
- runs `test` for touched workspaces (if `test` script exists)
- if global files are touched (for example `package.json`, `scripts/*`), checks are expanded to the full monorepo

Goal:

- block commits with broken build/tests before CI.

### `npm run hooks:install`

Installs local git hook:

- sets `core.hooksPath` to `.githooks`
- makes `.githooks/pre-commit` executable

After this command, each `git commit` runs `npm run precommit:check`.

## Recommended development flow

1. Implement feature/fix.
2. Run relevant local tests.
3. Add changeset:

```bash
npm run changeset
```

4. Commit code + changeset.
5. Open PR.

## PR CI flow (`.github/workflows/ci.yml`)

CI executes:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm run test:packages`
5. changeset check on PR:

```bash
npx changeset status --since=origin/main
```

If a required changeset is missing, update the PR.

## Release flow (current)

Release is executed with the guided command:

```bash
npm run deploy:npm
```

What it does:

1. asks package/tag/version choices
2. runs pre-checks (`npm whoami`, build, test, pack dry-run)
3. calls publish flow through `scripts/publish-libs.mjs`

`scripts/publish-libs.mjs --mode npm` runs CLI template smoke checks by default before publishing.

## Common issues

- Missing changeset in PR:
- run `npm run changeset` and commit the generated file.

- Release does not publish:
- verify `NPM_TOKEN` in repository secrets.

- Internal versions are not updated as expected:
- check `.changeset/config.json` (`updateInternalDependencies`).

- Pre-commit hook does not run:
- run `npm run hooks:install` once in your local clone.

## Reference files

- `.changeset/config.json`
- `.github/workflows/ci.yml`
- `.github/workflows/cli-template-smoke.yml`
- `scripts/pre-commit.mjs`
- [`1000 - Repository Versioning Policy`](./1000-repository-versioning-policy.md)
