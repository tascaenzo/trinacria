# Repository: Auto-update dipendenze (SemVer)

Questo flusso aggiorna in automatico le dipendenze in modo **semver-safe** e invia una mail quando sono disponibili update **major**.

Workflow:
- `.github/workflows/dependency-auto-update.yml`

Script di supporto:
- `scripts/dependency-major-report.mjs`

## Cosa fa

1. Esegue `npm ci`.
2. Rileva update major disponibili (`npm outdated --json --long ...`).
3. Aggiorna solo patch/minor consentiti dai range (`npm update --workspaces --include-workspace-root`).
4. Aggiorna lockfile e apre PR automatica.
5. Se rileva major, invia una mail con il report.

## Schedulazione

- dal lunedi` al venerdi` alle 07:00 UTC.
- eseguibile anche manualmente (`workflow_dispatch`).

## Secret richiesti per email

- `MAJOR_UPDATE_EMAIL_TO`
- `SMTP_SERVER`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Se i secret mail non sono presenti, il workflow continua senza invio email.

## Nota importante

Gli update major **non** vengono applicati automaticamente. Vengono solo notificati via email per revisione manuale.
