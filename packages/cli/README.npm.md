# @trinacria/cli

`@trinacria/cli` is the command-line tool for Trinacria apps.

It provides:

- app scaffolding (`new`, `create`, `init`)
- development mode with watch/restart (`dev`)
- TypeScript build (`build`)
- production start from compiled output (`start`)

## Install

Use it without global install:

```bash
npx @trinacria/cli@alpha --help
```

Or install in your project:

```bash
npm i -D @trinacria/cli
```

## Create a new app

```bash
npx @trinacria/cli@alpha new my-app
cd my-app
npm install
npm run dev
```

Quick start with explicit templates:

```bash
npx @trinacria/cli@alpha new my-app --template app-starter
npx @trinacria/cli@alpha new my-cron --template cron-example
npx @trinacria/cli@alpha new my-api-pg --template api-prisma-postgresql
npx @trinacria/cli@alpha new my-api-mongo --template api-mongoose-mongodb
npx @trinacria/cli@alpha new my-api-redis --template api-events-redis
npx @trinacria/cli@alpha new my-api-rabbit --template api-events-rabbitmq
```

Aliases:

```bash
npx @trinacria/cli@alpha create my-app
npx @trinacria/cli@alpha init my-app
```

## Available templates

- `app-starter` (aliases: `minimal`, `starter`, `base`, `default`)
- `cron-example`
- `api-prisma-postgresql`
- `api-mongoose-mongodb`
- `api-events-redis`
- `api-events-rabbitmq`

Example:

```bash
npx @trinacria/cli@alpha new my-app --template minimal
```

## Commands

```bash
trinacria new <project-name> [--template <name>] [--no-install] [--no-git] [--force]
trinacria dev
trinacria build
trinacria start
```

## Config file

Supported config names in your app root:

- `trinacria.config.js`
- `trinacria.config.cjs`
- `trinacria.config.mjs`

Example:

```js
/** @type {import('@trinacria/cli').TrinacriaConfig} */
export default {
  entry: "src/main.ts",
  outDir: "dist",
  watchDir: "src",
  env: "development",
};
```

## Notes

- In generated apps, `@trinacria/cli` is added to `devDependencies`.
- Generated app includes `.env` created from `.env.example` (if present).
- Generated app keeps `.gitignore` (and writes a default one if missing).
- `@trinacria/*` dependencies are generated as semver-compatible ranges from the versions bundled in CLI release templates.
- `dev` uses watch mode with automatic restart on source changes.
- `start` runs the compiled file mapped from your configured entry.

## Links

- Repository: [https://github.com/tascaenzo/trinacria](https://github.com/tascaenzo/trinacria)
- Documentation: see `docs/en` and `docs/it` in the repository.
