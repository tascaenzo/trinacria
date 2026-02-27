# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [0.1.0-alpha.0] - 2026-02-27

### Added
- New `@trinacria/cli` app scaffolding flow: `trinacria new`, `create`, `init`.
- Template aliases for base app: `minimal`, `starter`, `base`, `default`.
- Guided npm release flow: `npm run release:npm`.
- CLI template smoke test runner: `npm run smoke:cli:templates`.
- CI workflow for end-to-end template smoke checks: `.github/workflows/cli-template-smoke.yml`.
- npm-facing READMEs for all public packages (`README.npm.md`).

### Changed
- Publishing pipeline now supports npm-specific package README replacement (`README.npm.md` -> `README.md` in tarball).
- Release tooling simplified around npm publish flows and guided release.
- App templates now generate standalone `tsconfig.json` files (no monorepo path dependency).
- Generated template docs and npm package docs aligned for end users.

### Fixed
- CLI template packaging now includes runtime templates in published artifacts.
- Generated apps now include `.gitignore`.
- Generated app dependencies now include required dev tools for TypeScript/node typing.
- Docker/partial-build compatibility for CLI template copy script.
- Smoke pipeline stability:
  - handles non-HTTP one-shot templates correctly
  - treats long-running templates (like `cron-example`) as daemon start flows
  - hardens process shutdown to avoid CI hangs
