# Repository: Library Publish and Artifact Pipeline

This guide explains the current flow to generate npm artifacts and publish monorepo libraries in a repeatable way.

Primary script:

- `scripts/publish-libs.mjs`

Publish npm script (root `package.json`):

- `npm run deploy:npm` (single guided publish flow)

## Goal

- generate distribution-ready npm artifacts (`.tgz`)
- keep build/test and publish clearly separated
- run CLI template smoke checks before real publish
- keep traceability through checksums and artifact manifest metadata

## Available modes

### 1) `pack` (artifacts only, advanced)

Generates tarballs without publishing.

```bash
node scripts/publish-libs.mjs --mode pack
```

### 2) `npm` (registry publish, advanced)

Publishes generated tarballs via `npm publish <tarball>`.
This guarantees the published content matches the validated artifact.

```bash
node scripts/publish-libs.mjs --mode npm
```

Dry-run (no real publish):

```bash
node scripts/publish-libs.mjs --mode npm --dry-run
```

Before real publish, `--mode npm` runs the CLI template smoke gate by default:

- `node scripts/cli-template-smoke.mjs`

If you must bypass it:

```bash
node scripts/publish-libs.mjs --mode npm --skip-cli-smoke
```

## Artifact layout

Default output: `.tmp/artifacts/npm`

- `.tmp/artifacts/npm/<package>/<version>/<tarball>.tgz`
- `.tmp/artifacts/npm/<package>/<version>/<tarball>.tgz.sha256`
- `.tmp/artifacts/npm/manifest.json`

`manifest.json` includes:

- generation timestamp
- selected mode
- package list with tarball path, hashes and metadata (`integrity`, `shasum`, size)

## Recommended flow

1. Local validation without publishing (advanced):

```bash
node scripts/publish-libs.mjs --mode pack
node scripts/publish-libs.mjs --mode npm --dry-run
```

2. Verify artifacts:

```bash
cat .tmp/artifacts/npm/manifest.json
tar -tzf .tmp/artifacts/npm/<package>/<version>/<file>.tgz
```

3. Real registry publish (recommended):

```bash
npm run deploy:npm
```

## Useful options

- `--packages @trinacria/core,@trinacria/http`: limit package scope
- `--artifacts-dir <path>`: custom artifact directory
- `--skip-build`: skip build (only if already built)
- `--skip-test`: skip tests (only if risk is accepted)
- `--skip-existing`: skip publish when `package@version` already exists in registry
- `--skip-cli-smoke`: skip CLI template smoke gate
- `--dry-run`: no-op publish simulation

Example:

```bash
node scripts/publish-libs.mjs --mode pack --packages @trinacria/core,@trinacria/http --artifacts-dir .tmp/artifacts/release
```

## Operational requirements

- available and working `npm`
- valid registry auth/token for real publish
