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

## Operational notes

- To enable local pre-commit hook:

```bash
npm run hooks:install
```

- To test wiki sync manually without pushing, run `workflow_dispatch` from the Actions tab.
