# Scripts Directory

This directory contains operational scripts used by the repository for local checks and CI automations.

## Script list

### `pre-commit.mjs`

Purpose:
- run automated checks before commit.

What it does:
- reads staged files (`git diff --cached`).
- detects touched workspaces (only `packages/*`).
- runs `build` on touched workspaces that define a `build` script.
- runs `test` on touched workspaces that define a `test` script.
- if global files are touched (`package.json`, `package-lock.json`, `tsconfig.base.json`, `scripts/*`), it expands checks to all packages.

Manual execution:

```bash
node scripts/pre-commit.mjs
```

Related npm script:

```bash
npm run precommit:check
```

---

### `sync-wiki.sh`

Purpose:
- sync repository documentation (`docs/`) into GitHub Wiki.

What it does:
- clones the wiki repository (`<owner>/<repo>.wiki.git`).
- cleans previously generated wiki content.
- copies `docs/assets` and `docs/en` into the wiki.
- generates `Home.md` and `_Sidebar.md`.
- rewrites internal markdown links (`./x.md`, `../x.md`) to wiki-compatible format.
- commits/pushes only when changes exist.

Behavior when wiki is unavailable:
- logs a skip message and exits with code `0` (does not fail the pipeline).

Required environment variables:
- `GITHUB_REPOSITORY` (example: `tascaenzo/trinacria`)
- `GITHUB_TOKEN`
- `GITHUB_WORKSPACE` (automatically provided in GitHub Actions)

Manual execution (CI-like environment):

```bash
chmod +x scripts/sync-wiki.sh
scripts/sync-wiki.sh
```

Related workflow:
- `.github/workflows/wiki-sync.yml`

---

### `docker-smoke.sh`

Purpose:
- run a Docker smoke test for an app and fail if it does not boot cleanly.

What it does:
- creates a temporary env file from `apps/<app>/.env.example`.
- starts services with `docker compose up --build -d`.
- polls `http://127.0.0.1:<DOCKER_API_PORT>/health` until success.
- fails early if any container exits before health check passes.
- prints compose logs on failure.
- always runs `docker compose down -v --remove-orphans` in cleanup.

Manual execution:

```bash
bash scripts/docker-smoke.sh apps/api-prisma-postgresql
bash scripts/docker-smoke.sh apps/api-mongoose-mongodb
```

Related npm scripts:

```bash
npm run docker:smoke:api-prisma-postgresql
npm run docker:smoke:api-mongoose-mongodb
npm run docker:smoke:apps
```

Related workflow:
- `.github/workflows/docker-smoke.yml`

---

### `publish-libs.mjs`

Purpose:
- prepare and publish workspace libraries (`packages/*`) with one command.

Modes:
- `pack`: build/test + generate `.tgz` artifacts only.
- `npm`: build/test + CLI template smoke gate + `npm publish` (supports `--registry`, `--access`, `--dry-run`, `--skip-existing`).

Production artifact layout:
- `<artifacts-dir>/<package>/<version>/<tarball>.tgz`
- `<artifacts-dir>/<package>/<version>/<tarball>.tgz.sha256`
- `<artifacts-dir>/manifest.json` (metadata + checksums)

Note:
- in `npm` mode the script publishes the generated tarball file, so published content is exactly the validated artifact.

Common usage:

```bash
npm run publish:libs:pack
npm run publish:libs:npm
npm run publish:libs:npm:dry
```

Channel-oriented usage:

```bash
# alpha/stable channels -> npmjs (guided flow)
npm run release:npm
```

Manual npm release usage:

```bash
# stable on npm (changeset versions + publish with dist-tag latest)
npm run release:npm:stable:dry
npm run release:npm:stable

# guided release on npm (package + suggested next version + confirmation)
npm run release:npm
```

Publish already-versioned artifacts to npm alpha tag:

```bash
npm run publish:libs:npm:alpha:dry
npm run publish:libs:npm:alpha
```

Notes:
- `publish-libs.mjs --mode npm` runs `node scripts/cli-template-smoke.mjs` before publish by default (`--skip-cli-smoke` to bypass).
- if a package contains `README.npm.md`, `publish-libs.mjs` uses it as `README.md` in the published tarball.

Advanced examples:

```bash
node scripts/publish-libs.mjs --mode npm --registry https://npm.pkg.github.com --access restricted
node scripts/publish-libs.mjs --mode pack --packages @trinacria/core,@trinacria/http --artifacts-dir .artifacts/release
```

---

### `cli-template-smoke.mjs`

Purpose:
- end-to-end smoke test for `@trinacria/cli` scaffolding before release.

What it does:
- builds framework packages
- generates one app per template (`new --template ...`)
- rewrites `@trinacria/*` dependencies to local `file:` packages
- installs deps, builds app, runs `start`, then runs `dev` and validates watch-mode stability after file change
- for HTTP templates, checks `/health` endpoint

Related npm script:

```bash
npm run smoke:cli:templates
```

Related workflow:
- `.github/workflows/cli-template-smoke.yml`

---

### `release-npm-guided.mjs`

Purpose:
- interactive npm release flow for one package with progressive version suggestion.

What it does:
- asks menu-driven numeric choices (`package`, `tag`, bump strategy, version mode, publish/dry-run)
- suggests next version (`alpha` progression or stable bump)
- runs pre-checks (`npm whoami`, build, test, `npm pack --dry-run`)
- updates package version (`npm version --no-git-tag-version`)
- runs publish flow via `publish-libs.mjs` (or dry-run if publish is not confirmed)

Related npm script:

```bash
npm run release:npm
```

---

### `pre-release-checklist-cli-alpha.md`

Purpose:
- operational pre-release checklist for `@trinacria/cli` alpha releases on npm.

What it covers:
- repo/worktree sanity checks
- package build/test gates
- tarball content validation (`npm pack --dry-run`)
- local smoke test from packed artifact
- publish command and post-publish verification
- rollback/deprecate path for broken versions

## Operational notes

- To enable local pre-commit hook:

```bash
npm run hooks:install
```

- To test wiki sync manually without pushing, run `workflow_dispatch` from the Actions tab.
