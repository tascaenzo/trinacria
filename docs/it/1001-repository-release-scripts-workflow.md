# Release: Script e Workflow (Guida Pratica)

Questa guida spiega in modo operativo gli script npm legati a versioning/release e i workflow GitHub Actions configurati nel repository.

## Script disponibili

Definiti nel root `package.json`:

- `npm run changeset`
- `npm run changeset:status`
- `npm run version-packages`
- `npm run release`
- `npm run precommit:check`
- `npm run hooks:install`

## Cosa fa ogni script

### `npm run changeset`

Comando interattivo di Changesets.

Serve a creare un file markdown in `.changeset/` che descrive:

- quali package cambiano (`@trinacria/core`, `@trinacria/http`, ecc.)
- tipo di bump (`patch`, `minor`, `major`)
- nota release/changelog

Quando usarlo:

- ogni volta che una PR modifica comportamento/API di package pubblicati.

Output atteso:

- nuovo file tipo `.changeset/your-message.md` da committare insieme al codice.

### `npm run changeset:status`

Mostra lo stato dei changeset pendenti e quali versioni verranno generate.

Quando usarlo:

- prima di merge/release per verificare se manca qualche changeset
- in CI per controllo qualità del flusso release

### `npm run version-packages`

Esegue `changeset version`.

Cosa fa:

- legge i file in `.changeset/`
- aggiorna le versioni dei package coinvolti
- aggiorna dipendenze interne in base a `updateInternalDependencies`
- genera/aggiorna i `CHANGELOG.md` dei package
- consuma i changeset usati (li rimuove)

Quando usarlo:

- nella release PR gestita da automation (workflow release)
- localmente solo se vuoi simulare il risultato del release PR

### `npm run release`

Esegue `changeset publish`.

Cosa fa:

- pubblica su npm i package con nuova versione
- crea i relativi tag release

Quando usarlo:

- nel workflow `Release` su `main` (non manualmente su feature branch)

Prerequisiti:

- token npm configurato (`NPM_TOKEN`) nei secret GitHub Actions
- package non privati e configurati correttamente

### `npm run precommit:check`

Esegue `node scripts/pre-commit.mjs`.

Cosa fa:

- individua i workspace toccati dai file staged
- esegue `build` sui workspace toccati (se hanno script `build`)
- esegue `test` sui workspace toccati (se hanno script `test`)
- se tocchi file globali (es. `package.json`, `scripts/*`), estende i controlli a tutto il monorepo

Obiettivo:

- bloccare commit con build/test rotti prima che arrivino in CI.

### `npm run hooks:install`

Installa il git hook locale:

- imposta `core.hooksPath` su `.githooks`
- rende eseguibile `.githooks/pre-commit`

Dopo questo comando, a ogni `git commit` verrà eseguito `npm run precommit:check`.

## Flusso consigliato (sviluppo normale)

1. Sviluppa la feature/fix.
2. Esegui test locali pertinenti.
3. Crea changeset:

```bash
npm run changeset
```

4. Commit di codice + changeset.
5. Apri PR.

## Flusso CI su PR (`.github/workflows/ci.yml`)

La CI fa:

1. `npm ci`
2. `npm run lint`
3. `npm run build`
4. `npm run test:packages`
5. verifica changeset su PR con:

```bash
npx changeset status --since=origin/main
```

Se manca il changeset per una modifica che impatta package pubblicati, la PR dovrebbe essere aggiornata.

## Flusso release (attuale)

La release viene eseguita con il comando guidato:

```bash
npm run deploy:npm
```

Cosa fa:

1. chiede scelte package/tag/versione
2. esegue pre-check (`npm whoami`, build, test, pack dry-run)
3. richiama la publish tramite `scripts/publish-libs.mjs`

`scripts/publish-libs.mjs --mode npm` esegue di default gli smoke test dei template CLI prima della publish.

## Errori comuni e come risolverli

- "Manca changeset" in PR:
  - aggiungi `npm run changeset` e committa il file creato.

- Release non pubblica:
  - verifica `NPM_TOKEN` nei secrets repository.

- Versioni interne non aggiornate come atteso:
  - controlla `.changeset/config.json` (`updateInternalDependencies`).

- Hook pre-commit non parte:
  - esegui `npm run hooks:install` una volta nel clone locale.

## File di riferimento

- `.changeset/config.json`
- `.github/workflows/ci.yml`
- `.github/workflows/cli-template-smoke.yml`
- `scripts/pre-commit.mjs`
- [`1000 - Repository: Policy di Versioning`](./1000-repository-policy-versioning.md)
