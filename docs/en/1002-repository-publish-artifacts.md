# Repository: Library Publish and Artifact Pipeline

This guide explains the operational flow to generate npm artifacts and publish monorepo libraries in a safe, repeatable way.

Primary script:

- `scripts/publish-libs.mjs`

Convenience npm scripts (root `package.json`):

- `npm run publish:libs:pack`
- `npm run publish:libs:npm`
- `npm run publish:libs:npm:dry`
- `npm run publish:libs:git`
- `npm run publish:libs:git:dry`

## Goal

- generate distribution-ready npm artifacts (`.tgz`)
- keep build/test and publish clearly separated
- support dry-run and private registry publishing
- keep traceability through checksums and manifest metadata

## Release channel strategy

- `alpha` on GitHub Packages (workflow: `.github/workflows/release-alpha-github.yml`)
- `stable` on npmjs (workflow: `.github/workflows/release.yml`)

In the `alpha` workflow, package scope is remapped temporarily:

- from `@trinacria/*` to `@tascaenzo/*`

This enables personal GitHub Packages testing without changing the official stable scope.

## Available modes

### 1) `pack` (artifacts only)

Generates tarballs without publishing.

Usage:

```bash
npm run publish:libs:pack
```

### 2) `npm` (registry publish)

Publishes generated tarballs via `npm publish <tarball>`.
This guarantees the published content is exactly the validated artifact.

Usage:

```bash
npm run publish:libs:npm
```

Dry-run (no real publish):

```bash
npm run publish:libs:npm:dry
```

Private registry example:

```bash
node scripts/publish-libs.mjs --mode npm --registry https://npm.pkg.github.com --access restricted
```

Optional local auth setup:

```bash
cp .npmrc.github.example .npmrc
export NODE_AUTH_TOKEN=<github_token>
```

### 3) `git` (release tags)

Creates package/version tags, optional push:

```bash
npm run publish:libs:git
```

Simulation:

```bash
npm run publish:libs:git:dry
```

## Artifact layout (production-ready)

Default output: `.artifacts/npm`

Layout:

- `.artifacts/npm/<package>/<version>/<tarball>.tgz`
- `.artifacts/npm/<package>/<version>/<tarball>.tgz.sha256`
- `.artifacts/npm/manifest.json`

`manifest.json` includes:

- generation timestamp
- selected mode
- package list with tarball path, hashes and metadata (`integrity`, `shasum`, size)

## Tarball content

Packages use `files` whitelisting to include only publishable assets:

- `dist/`
- `README.md`
- `package.json`

Note: shipping `dist/` inside the tarball is correct and standard for compiled TypeScript libraries.

## Recommended flow

1. Local validation without publishing:

```bash
npm run publish:libs:pack
npm run publish:libs:npm:dry
```

2. Verify artifacts:

```bash
cat .artifacts/npm/manifest.json
tar -tzf .artifacts/npm/<package>/<version>/<file>.tgz
```

3. Real registry publish:

```bash
npm run publish:libs:npm
```

## Useful advanced options

- `--packages @trinacria/core,@trinacria/http`: limit package scope
- `--artifacts-dir <path>`: custom artifact directory
- `--skip-build`: skip build (only if already built)
- `--skip-test`: skip tests (only if risk is accepted)
- `--dry-run`: no-op simulation for publish/tag actions

Example:

```bash
node scripts/publish-libs.mjs --mode pack --packages @trinacria/core,@trinacria/http --artifacts-dir .artifacts/release
```

## Operational requirements

- available and working `npm`
- valid registry auth/token for real publish
- clean git working tree for `--mode git` (unless `--allow-dirty`)

## GitHub Packages: required setup

1. Configure `GITHUB_PACKAGES_TOKEN` (PAT with `write:packages`) for dedicated credentials; the workflow falls back to `GITHUB_TOKEN`.
2. The alpha workflow runs `npm run prepare:alpha:github` to map package names to `@tascaenzo/*` before publishing.
3. Stable channel is untouched and keeps publishing `@trinacria/*` to npmjs.
