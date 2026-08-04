---
"@trinacria/cli": patch
"@trinacria/core": patch
"@trinacria/cron": patch
"@trinacria/events": patch
"@trinacria/http": patch
"@trinacria/schema": patch
---

Require Node.js 24 and establish a production security baseline: deterministic
environment loading, bounded and asynchronous rate-limit stores, strict CORS,
HTTP connection and body limits, self-hosted Swagger UI, and bounded event
transport payloads. Compile framework packages with TypeScript 7 while retaining
the TypeScript 6 compatibility API required by CLI tooling. Replace ESLint with
Biome for JavaScript, TypeScript, and JSON linting, formatting, and import
organization.
