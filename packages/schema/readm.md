# @trinacria/schema - Implementation README

This package provides Trinacria's lightweight runtime schema system for validation, parsing, type inference, and OpenAPI schema generation.

## Goal

- validate unknown input with typed schemas
- parse and normalize values in a controlled way
- expose static type inference (`Infer<TSchema>`)
- generate OpenAPI-compatible schema objects

## Directory layout

```text
packages/schema/
  src/
    index.ts
    infer.ts
    core/
    builders/
    errors/
    openapi/
```

### `src/index.ts`

Public API surface:

- re-exports core schema contracts (`Schema`, `Infer`, parse result types)
- re-exports error types (`ValidationError`, `ValidationIssue`)
- re-exports OpenAPI helpers (`toOpenApi`)
- exports builder functions individually
- exports `s` namespace convenience object

### `src/core/`

Core schema runtime primitives:

- `schema.ts`
  - `createSchema(...)`: immutable schema factory
  - `Schema<T>` contract (`parse`, `safeParse`, `toOpenApi`, `optional`, `nullable`, `default`)
  - internal contract (`InternalSchema<T>`) used by composite builders
- `internal.ts`
  - `asInternal(...)` cast helper for composite builders
  - `isRecord(...)` plain-object guard

### `src/builders/`

Concrete schema builders:

- `primitives.ts`
  - `string`, `number`, `boolean`, `literal`
  - normalization/coercion and constraints (length, range, protocol, uuid, regex, etc.)
- `object.ts`
  - shaped object schemas with required/optional semantics
  - strict mode (`additionalProperties: false` behavior)
  - minimum property count
  - hardened own-property checks and safe key handling
- `array.ts`
  - item validation, bounds (`minItems`, `maxItems`), uniqueness
- `union.ts`
  - union parsing (`oneOf` semantics) with capped aggregated issues (`maxIssues`)
- `date.ts`
  - `date`, `dateString`, `dateTimeString`
  - coercion and strict range/format validation
- `enum.ts`
  - string enum from readonly tuple
- `modifiers.ts`
  - `optional`, `nullable`, `defaultValue`
- `index.ts`
  - barrel exports for all builders and option types

### `src/errors/`

Validation error model:

- `ValidationIssue` (`path`, `message`, `code`)
- `ValidationError` with issue list
- helpers to build/throw consistent issues (`validationIssue`, `throwValidation`)

### `src/openapi/`

OpenAPI conversion layer:

- `toOpenApi(schema)` delegates to schema-level `toOpenApi()`
- `OpenApiSchemaObject` shared type

## Runtime flow

1. A schema is built using builder functions (e.g. `object`, `array`, `string`).
2. The builder composes parsing logic through `createSchema(...)`.
3. `parse(input)` validates and returns typed output or throws `ValidationError`.
4. `safeParse(input)` returns `{ success, data | error }` without throwing.
5. `toOpenApi()` emits schema metadata for OpenAPI documents.

## Responsibility split

- `core/*`: schema contracts and immutable schema factory
- `builders/*`: domain validation logic and composition
- `errors/*`: error model and issue helpers
- `openapi/*`: documentation schema projection

## Security and robustness notes

Current implementation includes defensive behavior for common runtime risks:

- object parser reads only own-properties (no prototype-chain field reads)
- object output blocks dangerous keys (`__proto__`, `prototype`, `constructor`)
- builder option validation (e.g. `min <= max`, non-negative counts)
- numeric constraints validated (`multipleOf > 0`, finite bounds)
- regex checks avoid mutating shared `RegExp` instances
- union issue aggregation is capped to avoid unbounded error growth
- date-time string validation enforces strict ISO-8601 shape before parsing

## Recommended extension points

- add new builders on top of `createSchema(...)` for custom domain types
- add reusable modifiers by composing existing schema instances
- extend OpenAPI export strategy per builder when introducing new constraints

## Design note

`@trinacria/schema` is intentionally dependency-light and framework-agnostic.
It can be used standalone or as a shared validation layer across Trinacria packages.
