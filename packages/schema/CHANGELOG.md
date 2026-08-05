# @trinacria/schema

## 0.1.1

### Patch Changes

- 17664f2: Add platform-contract validation improvements and parser ergonomics for schema consumers.

  ### Added
  - `s.string({ semver: true })` for SemVer validation.
  - `s.string({ semverRange: true | { allowOr?: boolean } })` for SemVer range validation.
  - `superRefine((value, ctx) => ctx.addIssue(...))` for context-aware cross-field validation with custom issue paths.
  - `safeParse(input, { mode: "all" })` collect-all mode for aggregated validation issues.
  - Reusable custom string validator registry:
    - `registerStringValidator(name, fn)`
    - `s.string({ custom: { name, options?, code?, message? } })`

  ### Changed
  - Kept `parse(input)` as fail-fast while extending `safeParse` with configurable validation mode.
  - Extended docs and examples for plugin manifest validation workflows.

  ### Removed
  - Plugin ID built-in helper/option from core API in favor of project-level custom validators via registry.

- 054e81a: Require Node.js 24 and establish a production security baseline: deterministic
  environment loading, bounded and asynchronous rate-limit stores, strict CORS,
  HTTP connection and body limits, self-hosted Swagger UI, and bounded event
  transport payloads. Compile framework packages with TypeScript 7 while retaining
  the TypeScript 6 compatibility API required by CLI tooling. Replace ESLint with
  Biome for JavaScript, TypeScript, and JSON linting, formatting, and import
  organization.
