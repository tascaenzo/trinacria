# Repository: Publish Libraries e Artifact Pipeline

Questa guida descrive il flusso attuale per generare artifact npm e pubblicare librerie del monorepo in modo ripetibile.

Script principale:

- `scripts/publish-libs.mjs`

Script npm di comodo (root `package.json`):

- `npm run publish:libs:pack`
- `npm run publish:libs:npm`
- `npm run publish:libs:npm:dry`
- `npm run release:npm` (flusso guidato)

## Obiettivo

- generare artifact pronti alla distribuzione (`.tgz`)
- separare chiaramente build/test dalla publish
- eseguire smoke test CLI prima della publish reale
- mantenere tracciabilita con checksum e manifest

## Modalita disponibili

### 1) `pack` (solo artifact)

Genera i tarball senza pubblicare.

```bash
npm run publish:libs:pack
```

### 2) `npm` (publish su registry)

Pubblica i tarball generati con `npm publish <tarball>`.
In questo modo il contenuto pubblicato corrisponde all'artifact validato.

```bash
npm run publish:libs:npm
```

Dry-run (nessuna publish reale):

```bash
npm run publish:libs:npm:dry
```

Prima della publish reale, `--mode npm` esegue automaticamente lo smoke gate CLI:

- `node scripts/cli-template-smoke.mjs`

Se devi saltarlo:

```bash
node scripts/publish-libs.mjs --mode npm --skip-cli-smoke
```

## Struttura artifact

Output di default: `.artifacts/npm`

- `.artifacts/npm/<package>/<version>/<tarball>.tgz`
- `.artifacts/npm/<package>/<version>/<tarball>.tgz.sha256`
- `.artifacts/npm/manifest.json`

`manifest.json` contiene:

- timestamp di generazione
- modalita eseguita
- elenco package con path tarball, hash e metadati (`integrity`, `shasum`, size)

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
npm run release:npm
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
node scripts/publish-libs.mjs --mode pack --packages @trinacria/core,@trinacria/http --artifacts-dir .artifacts/release
```

## Requisiti operativi

- `npm` configurato e disponibile
- login/token valido per la registry target in caso di publish reale
