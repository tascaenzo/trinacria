# Repository Branching Workflow (`unstable` -> `develop` -> `main`)

This document defines a 3-branch model to support daily development, continuous testing, and progressive releases.

## Goal

- `unstable`: fast integration (daily PRs, frequent tests)
- `develop`: stabilization and prereleases (`alpha`/`beta`)
- `main`: stable releases (`latest`)

## Branch rules

### `unstable`

- Daily integration branch.
- All feature/fix branches open PRs into `unstable`.
- CI required (lint + build + package tests).
- Prefer one small, reviewable PR per day.

### `develop`

- Accepts PRs only from `unstable` once baseline is stable.
- Used for prereleases (`alpha`/`beta`).
- Regressions must be fixed before promotion to `main`.

### `main`

- Accepts PRs only from `develop`.
- Contains only release-ready stable code.
- Stable npm publication with `latest` tag.

## Recommended flow

1. Create feature branch from `unstable`.
2. Open PR to `unstable` (add changeset if you touch published packages).
3. Once `unstable` is stable, open PR `unstable` -> `develop`.
4. From `develop`, run guided prerelease and select `alpha` tag:
   - `npm run deploy:npm`
5. After validation, open PR `develop` -> `main`.
6. From `main`, run guided stable release and select `latest` tag:
   - `npm run deploy:npm`

## Test cadence

- Test on every PR/push via CI.
- Promotion tests on PRs targeting `develop` and `main` via the `Promotion Branch Tests` workflow.

## Initial branch setup

```bash
git checkout main
git pull

git checkout -b develop
git push -u origin develop

git checkout -b unstable
git push -u origin unstable
```

## Notes

- Keep PRs small on `unstable` for faster feedback and rollback.
- Avoid direct merges into `main`.
- For published packages, always include a changeset file.
