# Repository: Policy di Versioning

Questo repository usa Changesets per versionare e pubblicare i package.

## Strategia

- Modalità versioning: indipendente (ogni package può avanzare in modo autonomo)
- Convenzione versioni: SemVer (`MAJOR.MINOR.PATCH`)
- Branch base: `main`
- Workspace non pubblicati: `playground`, `api-prisma-postgresql`, `api-mongoose-mongodb`, `api-events-redis`, `api-events-rabbitmq`

## Flusso richiesto per modifiche ai package

1. Implementa le modifiche.
2. Aggiungi un changeset:

```bash
npm run changeset
```

3. Seleziona package coinvolti e tipo di bump:

- `patch`: fix e miglioramenti interni backward-compatible
- `minor`: nuove feature backward-compatible
- `major`: breaking changes

4. Committa codice + changeset nella stessa PR.

## Flusso release su `main`

1. Il workflow `Release` gira a ogni push su `main`.
2. Se ci sono changeset pendenti, apre/aggiorna una release PR (`chore: release packages`).
3. Il merge della release PR pubblica su npm e crea i tag.

## Script

- `npm run changeset`: crea un file changeset
- `npm run changeset:status`: mostra stato release pendenti
- `npm run version-packages`: applica bump versioni e changelog
- `npm run release`: pubblica package via Changesets

## Note

- `NPM_TOKEN` deve essere configurato nei secret GitHub del repository.
- Le note changelog devono essere sintetiche e orientate all'utente.
- Per breaking changes, includi note di migrazione nel body del changeset.

## Documenti correlati

- [`1001 - Repository: Script e Workflow Release`](./1001-repository-release-scripts-workflow.md)
- [`1003 - Repository: Workflow Branching`](./1003-repository-branching-workflow.md)
- [`1005 - Repository: Flussi reali attivi`](./1005-repository-real-workflows.md)
