# Pre-release checklist: `@trinacria/cli` (alpha)

Use this checklist before each alpha publish of the CLI package to npm.

Quick guided alternative:
- `npm run release:npm` (interactive menu with pre-checks + optional publish)

## 1) Repo state

- [ ] run from repo root: `cd /Users/enzo/Desktop/trinacria`
- [ ] verify branch/status: `git status --short`
- [ ] ensure there are no unintended changes in `packages/cli`

## 2) Package quality gates

- [ ] run CLI build: `npm run build --workspace @trinacria/cli`
- [ ] run CLI tests: `npm run test --workspace @trinacria/cli`
- [ ] run full CLI template smoke suite: `npm run smoke:cli:templates`
- [ ] verify templates are embedded in dist:
  - `find packages/cli/dist/templates -maxdepth 2 -type d | head -n 20`

## 3) Tarball validation (what will be published)

- [ ] dry-run pack using repo cache:
  - `npm pack --dry-run --workspace @trinacria/cli --cache /Users/enzo/Desktop/trinacria/.npm-cache`
- [ ] check tarball output contains:
  - `dist/commands/new.js`
  - `dist/templates/app-starter/...`
  - `dist/templates/cron-example/...`
  - `dist/templates/api-.../...`

## 4) Local smoke test from packed artifact

- [ ] create tarball:
  - `cd packages/cli && npm pack --cache /Users/enzo/Desktop/trinacria/.npm-cache`
- [ ] test scaffold from tarball in clean temp dir:
  - `TMPDIR=$(mktemp -d /tmp/trinacria-cli-smoke-XXXXXX)`
  - `cd "$TMPDIR"`
  - `npx -y -p /Users/enzo/Desktop/trinacria/packages/cli/trinacria-cli-*.tgz trinacria new smoke-app --no-install --no-git`
- [ ] verify generated files:
  - `test -f smoke-app/src/main.ts`
  - `test -f smoke-app/trinacria.config.mjs`
  - `test -f smoke-app/package.json`

## 5) Publish alpha

- [ ] login/npm identity check:
  - `npm whoami --registry https://registry.npmjs.org`
- [ ] publish with alpha tag:
  - `cd /Users/enzo/Desktop/trinacria/packages/cli`
  - `npm publish --tag alpha --access public --registry https://registry.npmjs.org`

## 6) Post-publish verification

- [ ] check published version/tag:
  - `npm view @trinacria/cli dist-tags --registry https://registry.npmjs.org`
- [ ] smoke test from npm (fresh dir):
  - `TMPDIR=$(mktemp -d /tmp/trinacria-cli-npm-smoke-XXXXXX)`
  - `cd "$TMPDIR"`
  - `npx -y @trinacria/cli@alpha new my-app --no-install --no-git`
- [ ] verify defaults/aliases:
  - `npx -y @trinacria/cli@alpha create my-app-2 --template starter --no-install --no-git`
  - `npx -y @trinacria/cli@alpha init my-app-3 --template default --no-install --no-git`

## 7) Rollback/mitigation (if needed)

- [ ] if broken, deprecate bad version with guidance:
  - `npm deprecate @trinacria/cli@<bad-version> "Broken scaffold templates, use <fixed-version>"`
- [ ] publish fixed alpha immediately and re-run section 6.
