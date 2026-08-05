# Repository: Workflow Branching (`unstable` -> `main`)

Questo documento definisce un flusso a due branch per integrazione quotidiana e release stabili.

## Obiettivo

- `unstable`: integrazione rapida (PR giornaliere, test frequenti)
- `main`: release stabili (`latest`)

## Regole per branch

### `unstable`

- Branch di integrazione quotidiana.
- Tutte le feature/fix branch fanno PR verso `unstable`.
- CI obbligatoria (lint + build + test package).
- Eseguire una PR al giorno, piccola e verificabile.
- Le prerelease (`alpha`, `beta` o `rc`) possono essere pubblicate da un commit
  validato di questo branch.

### `main`

- Riceve PR di promozione da `unstable`.
- Contiene solo codice pronto a release stabile.
- Pubblicazione npm stabile con tag `latest`.
- Le PR di promozione devono preservare l'ascendenza. Usa un merge commit; non
  eseguire squash della promozione `unstable` -> `main`.

## Flusso operativo consigliato

1. Crea branch feature da `unstable`.
2. Apri PR verso `unstable` (con changeset se tocchi package pubblicati).
3. Se necessario, esegui una prerelease dal commit validato di `unstable` e
   seleziona `alpha`, `beta` o `rc`:
   - `npm run deploy:npm`
4. Quando `unstable` è stabile, apri PR `unstable` -> `main`.
5. Esegui la promozione con un merge commit, senza squash.
6. Avanza `unstable` in fast-forward al merge commit risultante su `main`.
7. Da `main`, esegui la release stabile guidata e seleziona `latest`:
   - `npm run deploy:npm`

## Cadenza test

- Test a ogni PR/push tramite CI.
- Test di promozione sulle PR verso `main` tramite workflow `Promotion Branch Tests`.

## Setup iniziale branch

```bash
git checkout main
git pull

git checkout -b unstable
git push -u origin unstable
```

## Note

- Mantieni PR piccole su `unstable` per velocizzare feedback e rollback.
- Evita merge diretti su `main`.
- Non eseguire squash delle PR di promozione: preservare l'ascendenza evita
  divergenze e conflitti ripetuti tra branch.
- Per package pubblicati, non saltare il file changeset.
