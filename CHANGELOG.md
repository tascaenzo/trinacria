# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [0.1.1] - 2026-08-05

Stabilization release for `@trinacria/cli`, `@trinacria/core`,
`@trinacria/cron`, `@trinacria/events`, `@trinacria/http`, and
`@trinacria/schema`.

### Added

- Deterministic `.env` loading in `@trinacria/core`, with deployment values
  taking precedence over environment-specific files.
- Runtime module lifecycle coverage, provider-kind discovery, dependency
  boundary validation, and safer rollback behavior in `@trinacria/core`.
- Retry policies, renewable distributed locks, structured execution events,
  and improved failure reporting in `@trinacria/cron`.
- Event transport retries, health reporting, inbound deduplication,
  configurable idempotency stores, payload size limits, and malformed-message
  handling for Redis and RabbitMQ.
- Asynchronous and bounded rate-limit stores, strict CORS configuration,
  production security-header presets, request body limits, connection limits,
  request timeouts, proxy-aware client resolution, and HTTP authentication
  utilities in `@trinacria/http`.
- Self-hosted Swagger UI assets and optional Basic authentication for OpenAPI
  documentation endpoints.
- Schema validation support for SemVer, SemVer ranges, reusable custom string
  validators, context-aware `superRefine`, and collect-all `safeParse` mode.
- Security regression tests, dependency auditing, Dependabot configuration,
  and dedicated CI security checks.

### Changed

- Raised the supported runtime to Node.js `>=24 <25` for all public packages.
- Upgraded the repository compiler to TypeScript 7 while keeping the
  TypeScript 6 Compiler API isolated inside `@trinacria/cli` for compatibility.
- Replaced ESLint with Biome for JavaScript, TypeScript, and JSON linting,
  formatting, and import organization. Prettier is retained only for Markdown
  and YAML.
- Strengthened CI, pre-commit checks, coverage thresholds, package validation,
  template smoke tests, and dependency update reporting.
- Converted application Docker images to multi-stage builds with production
  runtime configuration and a non-root Node.js user.
- Updated all example applications to use validated configuration, explicit
  proxy trust, restricted CORS origins, protected documentation, and current
  package APIs.
- OpenAPI security requirements now correctly require the authentication cookie
  and CSRF header together for protected session mutations.

### Fixed

- Prevented duplicate singleton initialization during concurrent dependency
  resolution and improved cleanup when initialization or destruction fails.
- Ensured failed application startup, runtime module registration, module
  removal, and shutdown paths leave internal state consistent and reusable.
- Corrected module export conflicts, dependency visibility checks, provider
  indexing, import cleanup, and repeated signal-handler registration.
- Improved CLI build diagnostics, configuration discovery, output path
  resolution, development-process restart handling, crash-loop protection, and
  signal cleanup.
- Prevented unbounded in-memory rate-limit growth and oversized streaming request
  bodies.
- Improved router safety, response serialization, HTTP exception handling, and
  duplicate route detection.
- Ensured Redis and RabbitMQ listeners preserve callback references, retry
  transient failures, and apply queue durability settings consistently.
- Removed unsafe non-null assumptions from user updates, event transports,
  module lookup, and route traversal.

### Security

- JWTs are now bound to an explicit issuer and audience, and access tokens are
  validated against active server-side sessions.
- Refresh and mutation requests validate CSRF tokens against session state using
  timing-safe comparisons.
- Added role-based authorization middleware and user-resource access checks.
- Reduced login user-enumeration timing differences with a dummy Argon2
  verification path.
- Production configuration rejects placeholder secrets and insecure Swagger
  credentials.
- CORS no longer falls back to a wildcard origin when credentials are enabled.
- Swagger UI no longer depends on remotely hosted executable assets.
- HTTP and event transports enforce bounded input and payload sizes.

### Removed

- ESLint and its TypeScript integration dependencies.
- Generated Swagger `docs.html` files and CDN-based Swagger UI loading.
- The schema-specific plugin ID helper in favor of project-level custom
  validators.

### Migration notes

- Install and run the release with Node.js 24.
- Configure explicit CORS origins when cross-origin credentials are required.
- Configure Swagger documentation credentials before enabling docs in
  production.
- Replace plugin ID helper usage with `registerStringValidator` and
  `s.string({ custom: ... })`.

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
