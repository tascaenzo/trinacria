# Trinacria Documentation (English)

<p align="center">
  <img src="../assets/logo_transparent.png" alt="Logo Trinacria" width="220" />
</p>

This section contains the official documentation in English.

## Index

- [0000 - Getting Started (From zero to first API)](./0000-getting-started.md)
- [0001 - Runtime Foundation (Core Framework)](./0001-runtime-foundation.md)
- [0002 - HTTP Plugin](./0002-http-plugin.md)
- [0003 - CLI](./0003-cli.md)
- [0004 - Schema System](./0004-schema.md)
- [0005 - Cron Plugin](./0005-cron.md)
- [0006 - Events Plugin](./0006-events-plugin.md)
- [1000 - Repository Versioning Policy](./1000-repository-versioning-policy.md)
- [1001 - Repository Release Scripts and Workflows](./1001-repository-release-scripts-workflows.md)
- [1002 - Repository Library Publish and Artifacts](./1002-repository-publish-artifacts.md)
- [1003 - Repository Branching Workflow (`unstable` -> `develop` -> `main`)](./1003-repository-branching-workflow.md)
- [1004 - Repository: ESLint + Prettier Evaluation](./1004-eslint-prettier-evaluation.md)
- [1005 - Repository: Real active workflows](./1005-repository-real-workflows.md)
- [1006 - Repository: Dependency auto-update (SemVer)](./1006-repository-dependency-auto-update.md)

## Quick Links (Official EN)

- [HTTP Built-in Middleware Reference + Recipes](./0002-http-plugin.md)
- [Cron Plugin Guide + Lock Hooks](./0005-cron.md)
- [Events Plugin Guide (Internal Bus + Redis/RabbitMQ)](./0006-events-plugin.md)
- [Repository Versioning and Release Guide](./1001-repository-release-scripts-workflows.md)
- [Library Publish and Artifact Guide (pack/npm/git)](./1002-repository-publish-artifacts.md)

## Scope

- `@trinacria/core`: modular DI engine, application lifecycle, modules, plugins.
- `@trinacria/http`: HTTP plugin (routing, middleware, controllers, error handling).
- `@trinacria/cron`: scheduling plugin (interval/cron jobs, lock hooks, runtime rebuild).
- `@trinacria/events`: event bus plugin (in-process bus, Redis/RabbitMQ transports, production hooks).
- `@trinacria/cli`: development/runtime tooling (`dev`, `build`, `start`).
- `@trinacria/schema`: declarative schema DSL (validation, parsing, OpenAPI, type inference).
