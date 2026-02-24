# Scripts Directory

Questa directory contiene script operativi usati dal repository per controlli locali e automazioni CI.

## Elenco script

### `pre-commit.mjs`

Scopo:
- eseguire controlli automatici prima del commit.

Cosa fa:
- legge i file staged (`git diff --cached`).
- individua i workspace toccati (solo `packages/*`).
- esegue `build` sui workspace toccati che espongono lo script `build`.
- esegue `test` sui workspace toccati che espongono lo script `test`.
- se sono toccati file globali (`package.json`, `package-lock.json`, `tsconfig.base.json`, `scripts/*`), estende i controlli a tutti i package.

Esecuzione manuale:

```bash
node scripts/pre-commit.mjs
```

Script npm correlato:

```bash
npm run precommit:check
```

---

### `sync-wiki.sh`

Scopo:
- sincronizzare la documentazione del repository (`docs/`) nella GitHub Wiki.

Cosa fa:
- clona il repo wiki (`<owner>/<repo>.wiki.git`).
- pulisce il contenuto precedente generato.
- copia `docs/assets`, `docs/en`, `docs/it` nella wiki.
- genera `Home.md` e `_Sidebar.md`.
- riscrive i link markdown interni (`./x.md`, `../x.md`) in formato compatibile wiki.
- commit/push solo se ci sono modifiche.

Comportamento quando la wiki non è disponibile:
- stampa messaggio di skip ed esce con codice `0` (non fa fallire la pipeline).

Variabili richieste:
- `GITHUB_REPOSITORY` (es. `tascaenzo/trinacria`)
- `GITHUB_TOKEN`
- `GITHUB_WORKSPACE` (fornita automaticamente in GitHub Actions)

Esecuzione manuale (in ambiente CI):

```bash
chmod +x scripts/sync-wiki.sh
scripts/sync-wiki.sh
```

Workflow correlato:
- `.github/workflows/wiki-sync.yml`

## Note operative

- Per usare il pre-commit hook locale:

```bash
npm run hooks:install
```

- Per testare manualmente la sync wiki senza push, usa `workflow_dispatch` dal pannello Actions.
