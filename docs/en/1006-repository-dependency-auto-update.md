# Repository: Dependency Auto-Update (SemVer)

This flow updates dependencies automatically in a **semver-safe** way and sends an email when **major** updates are available.

Workflow:
- `.github/workflows/dependency-auto-update.yml`

Support script:
- `scripts/dependency-major-report.mjs`

## What it does

1. Runs `npm ci`.
2. Detects available major updates (`npm outdated --json --long ...`).
3. Applies only patch/minor updates allowed by ranges (`npm update --workspaces --include-workspace-root`).
4. Refreshes lockfile and opens an automated PR.
5. If majors are detected, sends an email report.

## Schedule

- Monday to Friday at 07:00 UTC.
- Can also run manually (`workflow_dispatch`).

## Required email secrets

- `MAJOR_UPDATE_EMAIL_TO`
- `SMTP_SERVER`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`

If mail secrets are missing, the workflow continues without sending email.

## Important note

Major updates are **not** auto-applied. They are only reported by email for manual review.
