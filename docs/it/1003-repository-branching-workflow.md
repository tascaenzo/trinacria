# Repository: Workflow Branching (`unstable` -> `develop` -> `main`)

Questo documento definisce un flusso a 3 branch per supportare sviluppo quotidiano, test continui e release progressive.

## Obiettivo

- `unstable`: integrazione rapida (PR giornaliere, test frequenti)
- `develop`: consolidamento funzionale e prerelease (`alpha`/`beta`)
- `main`: release stabili (`latest`)

## Regole per branch

### `unstable`

- Branch di integrazione quotidiana.
- Tutte le feature/fix branch fanno PR verso `unstable`.
- CI obbligatoria (lint + build + test package).
- Eseguire una PR al giorno, piccola e verificabile.

### `develop`

- Riceve PR solo da `unstable` quando la baseline e` stabile.
- Usato per prerelease (`alpha`/`beta`).
- Le regressioni bloccano la promozione verso `main`.

### `main`

- Riceve PR solo da `develop`.
- Contiene solo codice pronto a release stabile.
- Pubblicazione npm stabile con tag `latest`.

## Flusso operativo consigliato

1. Crea branch feature da `unstable`.
2. Apri PR verso `unstable` (con changeset se tocchi package pubblicati).
3. Quando `unstable` e`stabile, apri PR`unstable`->`develop`.
4. Da `develop`, esegui prerelease guidata e seleziona tag `alpha`:
   - `npm run deploy:npm`
5. Dopo validazione, apri PR `develop` -> `main`.
6. Da `main`, esegui release stabile guidata e seleziona tag `latest`:
   - `npm run deploy:npm`

## Cadenza test

- Test a ogni PR/push tramite CI.
- Test di promozione su PR verso `develop` e `main` tramite workflow `Promotion Branch Tests`.

## Setup iniziale branch

```bash
git checkout main
git pull

git checkout -b develop
git push -u origin develop

git checkout -b unstable
git push -u origin unstable
```

## Note

- Mantieni PR piccole su `unstable` per velocizzare feedback e rollback.
- Evita merge diretti su `main`.
- Per package pubblicati, non saltare il file changeset.
