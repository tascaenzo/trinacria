# Schema System (`@trinacria/schema`)

`@trinacria/schema` fornisce una DSL dichiarativa, runtime-first, per:

- validare dati sconosciuti
- parsare e normalizzare input
- inferire tipi TypeScript
- generare oggetti schema OpenAPI

Obiettivi di design:

- definition-first
- niente decorator
- niente reflection metadata
- niente AST/codegen
- riuso anche fuori HTTP

## Installazione

```bash
npm i @trinacria/schema
```

## Avvio rapido

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

## Contratto core

Ogni schema espone:

- `parse(input)` -> ritorna il valore parsato o lancia `ValidationError`
- `safeParse(input)` -> `{ success: true, data } | { success: false, error }`
- `toOpenApi()` -> oggetto schema OpenAPI
- modificatori fluent:
  - `.optional()`
  - `.nullable()`
  - `.default(value)`

## Builder

DSL principale:

- `s.string(options?)`
- `s.number(options?)`
- `s.boolean(options?)`
- `s.date(options?)`
- `s.dateString(options?)`
- `s.dateTimeString(options?)`
- `s.literal(value)`
- `s.array(itemSchema, options?)`
- `s.object(shape, options?)`
- `s.objectOf<Type>()(shape, options?)` (model-first con interface/type)
- `s.enum(["A", "B"] as const)`
- `s.union([schemaA, schemaB] as const)`

### Opzioni stringa

Tutte le opzioni supportate da `s.string(...)`:

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

Esempi:

```ts
const Email = s.string({ trim: true, toLowerCase: true, email: true });
const PublicUrl = s.string({ url: true, urlProtocols: ["https:"] });
const UuidV4 = s.string({ uuid: "4" });
const Slug = s.string({ pattern: /^[a-z0-9-]+$/, minLength: 3, maxLength: 64 });
const ApiKey = s.string({ startsWith: "sk_", minLength: 20, ascii: true });
const CountryCode = s.string({ uppercase: true, minLength: 2, maxLength: 2 });
```

### Opzioni number

Tutte le opzioni supportate da `s.number(...)`:

- `coerce?: boolean`
- `int?: boolean`
- `min?: number`
- `max?: number`
- `positive?: boolean`
- `negative?: boolean`
- `multipleOf?: number`

Esempi:

```ts
const Port = s.number({ coerce: true, int: true, min: 1, max: 65535 });
const Price = s.number({ min: 0, multipleOf: 0.01 });
const Delta = s.number({ negative: true });
```

### Opzioni boolean

Tutte le opzioni supportate da `s.boolean(...)`:

- `coerce?: boolean` (`"true"`, `"false"`, `"1"`, `"0"`, `1`, `0`)

Esempi:

```ts
const OpenApiEnabled = s.boolean({ coerce: true }).default(false);
const TrustProxy = s.boolean({ coerce: true }).default(false);
```

### Opzioni date

`s.date(...)` (ritorna `Date`):

- `coerce?: boolean`
- `min?: Date`
- `max?: Date`

`s.dateString(...)` (YYYY-MM-DD):

- `coerce?: boolean` (da `Date`)
- `min?: string`
- `max?: string`

`s.dateTimeString(...)` (stringa date-time ISO-like):

- `coerce?: boolean` (da `Date` / timestamp)
- `min?: Date`
- `max?: Date`

Esempi:

```ts
const BirthDate = s.dateString({ min: "1900-01-01", max: "2100-12-31" });
const CreatedAt = s.dateTimeString({ coerce: true });
const ExpiresAt = s.date({
  coerce: true,
  min: new Date("2020-01-01T00:00:00.000Z"),
});
```

### Opzioni array

Tutte le opzioni supportate da `s.array(...)`:

- `minItems?: number`
- `maxItems?: number`
- `nonEmpty?: boolean`
- `unique?: boolean | ((item) => unknown)`

Esempi:

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

### Opzioni object

Tutte le opzioni supportate da `s.object(...)`:

- `strict?: boolean`
- `minProperties?: number`

Esempio:

```ts
const PatchUser = s.object(
  {
    name: s.string({ trim: true, minLength: 1 }).optional(),
    email: s.string({ trim: true, toLowerCase: true, email: true }).optional(),
  },
  { strict: true, minProperties: 1 },
);
```

## Modello errori

`ValidationError` contiene una o più issue:

- `path: (string | number)[]`
- `message: string`
- `code: string`

Questo rende tracciabili gli errori annidati in oggetti/array.

## OpenAPI

Uso:

```ts
import { toOpenApi } from "@trinacria/schema";

const openapiSchema = toOpenApi(UserSchema);
```

Mapping principali:

- primitive -> `type`
- object -> `properties` + `required`
- `strict: true` -> `additionalProperties: false`
- union -> `oneOf`
- enum -> `enum`

## Casi d'uso reali

### 1) DTO request HTTP

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

### 2) Config environment all'avvio

```ts
const EnvSchema = s.object(
  {
    HOST: s.string({ trim: true, minLength: 1 }).default("0.0.0.0"),
    PORT: s
      .number({ coerce: true, int: true, min: 1, max: 65535 })
      .default(3000),
    OPENAPI_ENABLED: s.boolean({ coerce: true }).default(false),
    TRUST_PROXY: s.boolean({ coerce: true }).default(false),
  },
  { strict: false },
);
```

### 3) Validazione payload eventi

```ts
const UserCreatedEvent = s.object({
  type: s.literal("USER_CREATED"),
  payload: s.object({
    id: s.string({ uuid: "4" }),
    email: s.string({ email: true }),
  }),
});
```

### 4) Parse query/filter

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

### 5) Payload di scheduling / prenotazioni

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

## Uso fuori HTTP

Gli schema sono indipendenti dal transport e utili per:

- input environment/config
- payload di code/eventi
- input di servizi dominio
- argomenti CLI (dopo parse)
