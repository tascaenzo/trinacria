# Repository Branching Workflow (`unstable` -> `main`)

This document defines a two-branch model for daily integration and stable releases.

## Goal

- `unstable`: fast integration (daily PRs, frequent tests)
- `main`: stable releases (`latest`)

## Branch rules

### `unstable`

- Daily integration branch.
- All feature/fix branches open PRs into `unstable`.
- CI required (lint + build + package tests).
- Prefer one small, reviewable PR per day.
- Prereleases (`alpha`, `beta`, or `rc`) may be published from a validated
  commit on this branch.

### `main`

- Accepts promotion PRs from `unstable`.
- Contains only release-ready stable code.
- Stable npm publication with `latest` tag.
- Promotion PRs must preserve ancestry. Use a merge commit; do not squash the
  `unstable` -> `main` promotion.

## Recommended flow

1. Create feature branch from `unstable`.
2. Open PR to `unstable` (add changeset if you touch published packages).
3. If needed, run a guided prerelease from the validated `unstable` commit and
   select `alpha`, `beta`, or `rc`:
   - `npm run deploy:npm`
4. Once `unstable` is stable, open PR `unstable` -> `main`.
5. Merge the promotion with a merge commit, not squash merge.
6. Fast-forward `unstable` to the resulting `main` merge commit.
7. From `main`, run the guided stable release and select `latest`:
   - `npm run deploy:npm`

## Test cadence

- Test on every PR/push via CI.
- Promotion tests on PRs targeting `main` via the `Promotion Branch Tests` workflow.

## Initial branch setup

```bash
git checkout main
git pull

git checkout -b unstable
git push -u origin unstable
```

## Notes

- Keep PRs small on `unstable` for faster feedback and rollback.
- Avoid direct merges into `main`.
- Do not squash promotion PRs: preserving ancestry prevents branch divergence
  and repeated merge conflicts.
- For published packages, always include a changeset file.
