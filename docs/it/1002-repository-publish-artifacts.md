# Repository: Publish Libraries e Artifact Pipeline

Questa guida descrive il flusso attuale per generare artifact npm e pubblicare librerie del monorepo in modo ripetibile.

Script principale:

- `scripts/publish-libs.mjs`

Script npm di publish (root `package.json`):

- `npm run deploy:npm` (flusso guidato unico)

## Obiettivo

- generare artifact pronti alla distribuzione (`.tgz`)
- separare chiaramente build/test dalla publish
- eseguire smoke test CLI prima della publish reale
- mantenere tracciabilita con checksum e manifest

## Modalita disponibili

### 1) `pack` (solo artifact, avanzato)

Genera i tarball senza pubblicare.

```bash
node scripts/publish-libs.mjs --mode pack
```

### 2) `npm` (publish su registry, avanzato)

Pubblica i tarball generati con `npm publish <tarball>`.
In questo modo il contenuto pubblicato corrisponde all'artifact validato.

```bash
node scripts/publish-libs.mjs --mode npm
```

Dry-run (nessuna publish reale):

```bash
node scripts/publish-libs.mjs --mode npm --dry-run
```

Prima della publish reale, `--mode npm` esegue automaticamente lo smoke gate CLI:

- `node scripts/cli-template-smoke.mjs`

Se devi saltarlo:

```bash
node scripts/publish-libs.mjs --mode npm --skip-cli-smoke
```

## Struttura artifact

Output di default: `.tmp/artifacts/npm`

- `.tmp/artifacts/npm/<package>/<version>/<tarball>.tgz`
- `.tmp/artifacts/npm/<package>/<version>/<tarball>.tgz.sha256`
- `.tmp/artifacts/npm/manifest.json`

`manifest.json` contiene:

- timestamp di generazione
- modalita eseguita
- elenco package con path tarball, hash e metadati (`integrity`, `shasum`, size)

## Flusso consigliato

1. Validazione locale senza publish (avanzata):

```bash
node scripts/publish-libs.mjs --mode pack
node scripts/publish-libs.mjs --mode npm --dry-run
```

2. Verifica artifact:

```bash
cat .tmp/artifacts/npm/manifest.json
tar -tzf .tmp/artifacts/npm/<package>/<version>/<file>.tgz
```

3. Publish reale su registry (consigliato):

```bash
npm run deploy:npm
```

## Opzioni utili

- `--packages @trinacria/core,@trinacria/http`: limita i package
- `--artifacts-dir <path>`: cartella artifact custom
- `--skip-build`: salta build (se gia eseguita)
- `--skip-test`: salta test (solo se accetti il rischio)
- `--skip-existing`: salta publish se `package@version` esiste gia nella registry
- `--skip-cli-smoke`: salta smoke gate CLI
- `--dry-run`: simulazione publish

Esempio:

```bash
node scripts/publish-libs.mjs --mode pack --packages @trinacria/core,@trinacria/http --artifacts-dir .tmp/artifacts/release
```

## Requisiti operativi

- `npm` configurato e disponibile
- login/token valido per la registry target in caso di publish reale
