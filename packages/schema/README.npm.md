# @trinacria/schema

`@trinacria/schema` is a lightweight runtime schema and validation package for TypeScript.

It provides:

- runtime parsing/validation
- TypeScript type inference
- optional coercion for env/API inputs
- OpenAPI schema projection

## Install

```bash
npm i @trinacria/schema
```

## Quick start

```ts
import { s, type Infer } from "@trinacria/schema";

const userSchema = s.object({
  id: s.number({ int: true, min: 1 }),
  email: s.string({ email: true }),
  active: s.boolean({ coerce: true }).default(true),
});

type User = Infer<typeof userSchema>;

const data: User = userSchema.parse({
  id: 1,
  email: "mario@example.com",
  active: "true",
});

console.log(data.active); // true
```

## OpenAPI

```ts
import { toOpenApi } from "@trinacria/schema";

const openApiSchema = toOpenApi(userSchema);
```

## Links

- Repository: [https://github.com/tascaenzo/trinacria](https://github.com/tascaenzo/trinacria)
- Docs: `docs/en/0004-schema.md`
