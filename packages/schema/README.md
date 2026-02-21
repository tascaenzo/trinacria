# @trinacria/schema - Implementation Guide

`@trinacria/schema` is a lightweight runtime schema system for validation, parsing, type inference, and OpenAPI projection.

## What this package is responsible for

- parse/validate unknown input with typed schemas
- normalize/coerce values when configured
- support coercion for number/date/date-string/date-time and boolean-like env values
- provide `safeParse` non-throwing API
- emit OpenAPI-compatible schema objects

## Directory structure

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

## Key implementation areas

### `src/core/`

- `createSchema(...)` immutable schema factory
- shared schema contract (`parse`, `safeParse`, `toOpenApi`)
- internal helpers for composite builders

### `src/builders/`

- primitives: `string`, `number`, `boolean`, `literal`
- collections: `object`, `array`, `union`
- date builders: `date`, `dateString`, `dateTimeString`
- modifiers: `optional`, `nullable`, `defaultValue`
- enum builder

Security hardening included in builders:

- object own-property checks
- dangerous object key blocking (`__proto__`, `prototype`, `constructor`)
- builder option validation (`min <= max`, finite values, non-negative counts)
- bounded issue aggregation for unions (`maxIssues`)
- strict date-time format checks

### `src/errors/`

- `ValidationError`
- structured issues (`path`, `message`, `code`)

### `src/openapi/`

- schema projection via `toOpenApi(schema)`

## Runtime flow

1. define schema with builders
2. parse input (`parse`/`safeParse`)
3. consume typed output
4. optionally project schema to OpenAPI

## Extension points for new contributors

- add new builder on top of `createSchema(...)`
- extend option validation policy in builder-level constructors
- expand OpenAPI mapping for advanced constraints

## Important design constraints

- keep package dependency-light and framework-agnostic
- preserve deterministic error shape for API consumers
- avoid implicit coercions unless explicitly configured
