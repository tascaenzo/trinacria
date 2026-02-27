# Repository: Valutazione ESLint + Prettier

Questa guida propone un'adozione graduale di ESLint e Prettier, minimizzando il rischio su un monorepo gia` attivo.

## Perche` introdurli

- Standard comune su codice e stile nei package.
- PR piu` piccole e review piu` veloci.
- Riduzione regressioni banali (unused vars, import errati, errori sintattici).

## Strategia consigliata (in 3 step)

1. Attiva prima in `unstable`.
2. Esegui fix automatico una sola volta (`lint:fix` + `format`) in una PR dedicata.
3. Solo dopo merge stabile, rendi i check obbligatori in CI.

## Setup consigliato

Dipendenze root:

```bash
npm i -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

Script root consigliati:

```json
{
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier . --write",
  "format:check": "prettier . --check"
}
```

## Integrazione con il tuo flusso branch

- `unstable`: esegui `lint` + `test` su ogni PR.
- `develop`: blocca merge se `format:check` o `lint` falliscono.
- `main`: promuovi solo se pipeline pulita, poi release stabile.

## Nota operativa

In questo repository, l'introduzione va fatta in una PR dedicata che aggiorna insieme:

- `package.json`
- `package-lock.json`
- file config (`eslint.config.*`, `.prettierrc*`, `.prettierignore`)
- CI (`.github/workflows/*.yml`)

cosi` eviti mismatch tra lockfile e script CI.
