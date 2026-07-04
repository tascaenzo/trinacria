# Documentazione Trinacria (Italiano)

<p align="center">
  <img src="../assets/logo_transparent.png" alt="Logo Trinacria" width="220" />
</p>

Questa sezione raccoglie la documentazione ufficiale in italiano.

## Indice

- [0000 - Getting Started (Da zero a prima API)](./0000-getting-started.md)
- [0001 - Runtime Foundation (Core Framework)](./0001-runtime-foundation.md)
- [0002 - Plugin HTTP](./0002-http-plugin.md)
- [0003 - CLI](./0003-cli.md)
- [0004 - Schema System](./0004-schema.md)
- [0005 - Plugin Cron](./0005-cron.md)
- [0006 - Plugin Events](./0006-events-plugin.md)
- [1000 - Repository: Policy di Versioning](./1000-repository-policy-versioning.md)
- [1001 - Repository: Script e Workflow Release](./1001-repository-release-scripts-workflow.md)
- [1002 - Repository: Publish librerie e artifact npm](./1002-repository-publish-artifacts.md)
- [1003 - Repository: Workflow Branching (`unstable` -> `develop` -> `main`)](./1003-repository-branching-workflow.md)
- [1004 - Repository: Valutazione ESLint + Prettier](./1004-eslint-prettier-evaluation.md)
- [1005 - Repository: Flussi reali attivi](./1005-repository-real-workflows.md)
- [1006 - Repository: Auto-update dipendenze (SemVer)](./1006-repository-dependency-auto-update.md)

## Link Rapidi (Official IT)

- [Riferimento Middleware HTTP Built-in + Ricette](./0002-http-plugin.md)
- [Guida Plugin Cron + Hook Lock](./0005-cron.md)
- [Guida Plugin Events (Bus interno + Redis/RabbitMQ)](./0006-events-plugin.md)
- [Guida Release e Versioning (Changesets + CI)](./1001-repository-release-scripts-workflow.md)
- [Guida Publish Artifact e Registry (pack/npm/git)](./1002-repository-publish-artifacts.md)

## Ambito

- `@trinacria/core`: motore DI modulare, lifecycle applicativo, moduli, plugin.
- `@trinacria/http`: plugin HTTP (routing, middleware, controller, error handling).
- `@trinacria/cron`: plugin di schedulazione (job interval/cron, hook lock, rebuild runtime).
- `@trinacria/events`: plugin event bus (bus in-process, trasporti Redis/RabbitMQ, hook production).
- `@trinacria/cli`: tool di sviluppo/esecuzione (`dev`, `build`, `start`).
- `@trinacria/schema`: DSL dichiarativa per schema dati (validazione, parsing, OpenAPI, type inference).
