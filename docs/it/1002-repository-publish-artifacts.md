# Repository: Publish Libraries e Artifact Pipeline

Questa guida descrive il flusso operativo per generare artifact npm e pubblicare librerie del monorepo in modo sicuro e ripetibile.

Script principale:

- `scripts/publish-libs.mjs`

Script npm di comodo (root `package.json`):

- `npm run publish:libs:pack`
- `npm run publish:libs:npm`
- `npm run publish:libs:npm:dry`
- `npm run publish:libs:git`
- `npm run publish:libs:git:dry`

## Obiettivo

- generare artifact pronti alla distribuzione (`.tgz`)
- separare chiaramente fase di build/test dalla fase di publish
- supportare dry-run e publish su registry privati
- mantenere tracciabilita con checksum e manifest

## Strategia canali release

- `alpha` su GitHub Packages (workflow: `.github/workflows/release-alpha-github.yml`)
- `stable` su npmjs (workflow: `.github/workflows/release.yml`)

Nel workflow `alpha` viene applicata una riscrittura temporanea dello scope:

- da `@trinacria/*` a `@tascaenzo/*`

Questo permette test personali su GitHub Packages senza cambiare lo scope ufficiale stable.

## Modalita disponibili

### 1) `pack` (solo artifact)

Genera i tarball senza pubblicare.

Uso:

```bash
npm run publish:libs:pack
```

### 2) `npm` (publish su registry)

Pubblica i tarball generati con `npm publish <tarball>`.
In questo modo il contenuto pubblicato e esattamente l'artifact verificato.

Uso:

```bash
npm run publish:libs:npm
```

Dry-run (nessuna publish reale):

```bash
npm run publish:libs:npm:dry
```

Registry privata:

```bash
node scripts/publish-libs.mjs --mode npm --registry https://npm.pkg.github.com --access restricted
```

Autenticazione locale (opzionale):

```bash
cp .npmrc.github.example .npmrc
export NODE_AUTH_TOKEN=<github_token>
```

### 3) `git` (tag release)

Crea tag per package/versione, con push opzionale:

```bash
npm run publish:libs:git
```

Simulazione:

```bash
npm run publish:libs:git:dry
```

## Struttura artifact (production-ready)

Output di default: `.artifacts/npm`

Layout:

- `.artifacts/npm/<package>/<version>/<tarball>.tgz`
- `.artifacts/npm/<package>/<version>/<tarball>.tgz.sha256`
- `.artifacts/npm/manifest.json`

`manifest.json` contiene:

- timestamp di generazione
- modalita eseguita
- elenco package con path tarball, hash e metadati (`integrity`, `shasum`, size)

## Contenuto tarball

I package sono configurati con `files` per includere solo asset pubblicabili:

- `dist/`
- `README.md`
- `package.json`

Nota: la directory `dist/` nel tarball e corretta e standard per librerie TypeScript compilate.

## Flusso consigliato

1. Validazione locale senza publish:

```bash
npm run publish:libs:pack
npm run publish:libs:npm:dry
```

2. Verifica artifact:

```bash
cat .artifacts/npm/manifest.json
tar -tzf .artifacts/npm/<package>/<version>/<file>.tgz
```

3. Publish reale su registry:

```bash
npm run publish:libs:npm
```

## Opzioni avanzate utili

- `--packages @trinacria/core,@trinacria/http`: limita i package
- `--artifacts-dir <path>`: cartella artifact custom
- `--skip-build`: salta build (se gia eseguita)
- `--skip-test`: salta test (solo se consapevole del rischio)
- `--skip-existing`: salta `publish` se `package@version` esiste gia nella registry
- `--dry-run`: simulazione no-op su publish/tag

Esempio:

```bash
node scripts/publish-libs.mjs --mode pack --packages @trinacria/core,@trinacria/http --artifacts-dir .artifacts/release
```

## Requisiti operativi

- `npm` configurato e disponibile
- login/token valido per la registry target in caso di publish reale
- working tree pulita per `--mode git` (salvo `--allow-dirty`)

## GitHub Packages: cosa configurare

1. Configura `GITHUB_PACKAGES_TOKEN` (PAT con `write:packages`) se vuoi forzare credenziali dedicate; in fallback viene usato `GITHUB_TOKEN`.
2. Il workflow alpha usa `npm run prepare:alpha:github` per mappare i package su `@tascaenzo/*` prima del publish.
3. Il canale stable non viene toccato: continua a pubblicare `@trinacria/*` su npmjs.
