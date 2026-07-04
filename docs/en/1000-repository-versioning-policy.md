# Repository Versioning Policy

This repository uses Changesets for package versioning and publishing.

## Strategy

- Versioning mode: independent (each package can bump independently)
- Versioning convention: SemVer (`MAJOR.MINOR.PATCH`)
- Base branch: `main`
- Non-published workspaces: `playground`, `api-prisma-postgresql`, `api-mongoose-mongodb`, `api-events-redis`, `api-events-rabbitmq`

## Required workflow for package changes

1. Implement the code changes.
2. Add a changeset:

```bash
npm run changeset
```

3. Select affected package(s) and bump type:

- `patch`: backward-compatible fixes/internal improvements
- `minor`: backward-compatible features
- `major`: breaking changes

4. Commit code + changeset in the same PR.

## Release flow on `main`

1. The `Release` workflow runs on pushes to `main`.
2. If pending changesets exist, it opens/updates a release PR (`chore: release packages`).
3. Merging that PR publishes packages to npm and creates tags.

## Scripts

- `npm run changeset`: create a changeset file
- `npm run changeset:status`: inspect pending release state
- `npm run version-packages`: apply bumps and update changelogs
- `npm run release`: publish packages via Changesets

## Notes

- `NPM_TOKEN` must be configured in GitHub repository secrets.
- Changelog notes should be concise and user-facing.
- For breaking changes, include migration notes in the changeset body.

## Related docs

- [`1001 - Repository Release Scripts and Workflows`](./1001-repository-release-scripts-workflows.md)
- [`1003 - Repository Branching Workflow`](./1003-repository-branching-workflow.md)
- [`1005 - Repository: Real active workflows`](./1005-repository-real-workflows.md)
