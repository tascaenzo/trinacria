# Repository: ESLint + Prettier Evaluation

This guide proposes a gradual ESLint/Prettier rollout with low risk for an active monorepo.

## Why add them

- Shared style and quality baseline across packages.
- Smaller PRs and faster reviews.
- Fewer avoidable regressions (unused vars, import issues, syntax mistakes).

## Recommended strategy (3 steps)

1. Roll out first on `unstable`.
2. Run one dedicated auto-fix PR (`lint:fix` + `format`).
3. Only after stabilization, enforce checks in CI.

## Suggested setup

Root dependencies:

```bash
npm i -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

Suggested root scripts:

```json
{
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier . --write",
  "format:check": "prettier . --check"
}
```

## Integration with your branch flow

- `unstable`: run `lint` + `test` on every PR.
- `develop`: block merge when `format:check` or `lint` fails.
- `main`: promote only after green pipelines, then stable release.

## Operational note

In this repository, adoption should be done in one dedicated PR that updates together:

- `package.json`
- `package-lock.json`
- config files (`eslint.config.*`, `.prettierrc*`, `.prettierignore`)
- CI (`.github/workflows/*.yml`)

so you avoid lockfile/CI mismatch.
