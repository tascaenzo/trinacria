# Schema System (`@trinacria/schema`)

`@trinacria/schema` provides a declarative, runtime-first schema DSL for:

- validating unknown data
- parsing and normalizing input values
- inferring TypeScript output types
- generating OpenAPI schema objects

Design goals:

- definition-first
- no decorators
- no reflection metadata
- no AST/codegen
- reusable outside HTTP

## Installation

```bash
npm i @trinacria/schema
```

## Quick start

```ts
import { s, type Infer } from "@trinacria/schema";

const UserSchema = s.object({
  id: s.string(),
  name: s.string({ trim: true, minLength: 1 }),
  email: s.string({ trim: true, toLowerCase: true, email: true }),
});

type User = Infer<typeof UserSchema>;

const user = UserSchema.parse({
  id: "1",
  name: " Mario ",
  email: "Mario@Test.Com",
});
```

## Core contract

All schema instances expose:

- `parse(input)` -> returns parsed value or throws `ValidationError`
- `safeParse(input)` -> `{ success: true, data } | { success: false, error }`
- `toOpenApi()` -> OpenAPI schema object
- fluent modifiers:
  - `.optional()`
  - `.nullable()`
  - `.default(value)`

## Builders

Main DSL:

- `s.string(options?)`
- `s.number(options?)`
- `s.boolean()`
- `s.date(options?)`
- `s.dateString(options?)`
- `s.dateTimeString(options?)`
- `s.literal(value)`
- `s.array(itemSchema, options?)`
- `s.object(shape, options?)`
- `s.objectOf<Type>()(shape, options?)` (model-first with interface/type)
- `s.enum(["A", "B"] as const)`
- `s.union([schemaA, schemaB] as const)`

### String options

All options currently supported by `s.string(...)`:

- `trim?: boolean`
- `toLowerCase?: boolean`
- `toUpperCase?: boolean`
- `minLength?: number`
- `maxLength?: number`
- `email?: boolean`
- `url?: boolean`
- `urlProtocols?: readonly string[]`
- `uuid?: true | "3" | "4" | "5" | "all"`
- `startsWith?: string`
- `endsWith?: string`
- `includes?: string`
- `pattern?: RegExp`
- `alpha?: boolean`
- `alphanumeric?: boolean`
- `ascii?: boolean`
- `lowercase?: boolean`
- `uppercase?: boolean`

Examples:

```ts
const Email = s.string({ trim: true, toLowerCase: true, email: true });
const PublicUrl = s.string({ url: true, urlProtocols: ["https:"] });
const UuidV4 = s.string({ uuid: "4" });
const Slug = s.string({ pattern: /^[a-z0-9-]+$/, minLength: 3, maxLength: 64 });
const ApiKey = s.string({ startsWith: "sk_", minLength: 20, ascii: true });
const CountryCode = s.string({ uppercase: true, minLength: 2, maxLength: 2 });
```

### Number options

All options currently supported by `s.number(...)`:

- `coerce?: boolean`
- `int?: boolean`
- `min?: number`
- `max?: number`
- `positive?: boolean`
- `negative?: boolean`
- `multipleOf?: number`

Examples:

```ts
const Port = s.number({ coerce: true, int: true, min: 1, max: 65535 });
const Price = s.number({ min: 0, multipleOf: 0.01 });
const Delta = s.number({ negative: true });
```

### Date options

`s.date(...)` (returns `Date`):

- `coerce?: boolean`
- `min?: Date`
- `max?: Date`

`s.dateString(...)` (YYYY-MM-DD):

- `coerce?: boolean` (from `Date`)
- `min?: string`
- `max?: string`

`s.dateTimeString(...)` (ISO-like date-time string):

- `coerce?: boolean` (from `Date` / timestamp)
- `min?: Date`
- `max?: Date`

Examples:

```ts
const BirthDate = s.dateString({ min: "1900-01-01", max: "2100-12-31" });
const CreatedAt = s.dateTimeString({ coerce: true });
const ExpiresAt = s.date({
  coerce: true,
  min: new Date("2020-01-01T00:00:00.000Z"),
});
```

### Array options

All options currently supported by `s.array(...)`:

- `minItems?: number`
- `maxItems?: number`
- `nonEmpty?: boolean`
- `unique?: boolean | ((item) => unknown)`

Examples:

```ts
const Tags = s.array(s.string({ trim: true, minLength: 1 }), {
  nonEmpty: true,
  maxItems: 10,
  unique: true,
});

const Users = s.array(
  s.object({ id: s.string({ uuid: "4" }), email: s.string({ email: true }) }),
  { unique: (user) => user.email.toLowerCase() },
);
```

### Object options

All options currently supported by `s.object(...)`:

- `strict?: boolean`
- `minProperties?: number`

Example:

```ts
const PatchUser = s.object(
  {
    name: s.string({ trim: true, minLength: 1 }).optional(),
    email: s.string({ trim: true, toLowerCase: true, email: true }).optional(),
  },
  { strict: true, minProperties: 1 },
);
```

## Error model

`ValidationError` contains one or more issues:

- `path: (string | number)[]`
- `message: string`
- `code: string`

This makes nested object/array validation errors traceable.

## OpenAPI

Use:

```ts
import { toOpenApi } from "@trinacria/schema";

const openapiSchema = toOpenApi(UserSchema);
```

Mapping highlights:

- primitives -> `type`
- object -> `properties` + `required`
- `strict: true` -> `additionalProperties: false`
- union -> `oneOf`
- enum -> `enum`

## Real-world use cases

### 1) HTTP request DTO

```ts
const CreateUserSchema = s.object(
  {
    name: s.string({ trim: true, minLength: 1, maxLength: 120 }),
    email: s.string({ trim: true, toLowerCase: true, email: true }),
    website: s.string({ url: true, urlProtocols: ["https:"] }).optional(),
  },
  { strict: true },
);
```

### 2) Environment config at startup

```ts
const EnvSchema = s.object(
  {
    HOST: s.string({ trim: true, minLength: 1 }).default("0.0.0.0"),
    PORT: s
      .number({ coerce: true, int: true, min: 1, max: 65535 })
      .default(3000),
  },
  { strict: false },
);
```

### 3) Event payload validation

```ts
const UserCreatedEvent = s.object({
  type: s.literal("USER_CREATED"),
  payload: s.object({
    id: s.string({ uuid: "4" }),
    email: s.string({ email: true }),
  }),
});
```

### 4) Query/filter parsing

```ts
const ListUsersQuery = s.object(
  {
    page: s.number({ coerce: true, int: true, min: 1 }).default(1),
    pageSize: s
      .number({ coerce: true, int: true, min: 1, max: 100 })
      .default(20),
    sort: s.enum(["createdAt", "name"] as const).default("createdAt"),
  },
  { strict: false },
);
```

### 5) Scheduling / booking payloads

```ts
const BookingSchema = s.object(
  {
    date: s.dateString({ min: "2026-01-01" }),
    startsAt: s.dateTimeString(),
    endsAt: s.dateTimeString(),
  },
  { strict: true },
);
```

## Usage outside HTTP

Schemas are runtime-agnostic and can validate:

- environment/config input
- queue/event payloads
- domain service inputs
- CLI arguments (after parsing)
