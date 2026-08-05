# @trinacria/schema

`@trinacria/schema` is a lightweight runtime schema and validation package for TypeScript.

It provides:

- runtime parsing/validation
- TypeScript type inference
- optional coercion for env/API inputs
- semver/semver-range validators
- context-aware `superRefine(...)` for cross-field checks
- configurable `safeParse(..., { mode: "all" })` for full issue collection
- reusable custom validator registry (`registerStringValidator`)
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

## Platform contracts example

```ts
import { registerStringValidator, s } from "@trinacria/schema";

registerStringValidator("plugin-id", (value) =>
  /^[a-z0-9][a-z0-9-._/]*$/.test(value),
);

const pluginManifestSchema = s
  .object({
    id: s.string({ custom: { name: "plugin-id" } }),
    version: s.string({ semver: true }),
    requiresCore: s.string({ semverRange: true }),
    dependencies: s.array(
      s.object({
        pluginId: s.string({ custom: { name: "plugin-id" } }),
        versionRange: s.string({ semverRange: true }),
        optional: s.boolean().default(false),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    value.dependencies.forEach((dependency, index) => {
      if (dependency.pluginId === value.id) {
        ctx.addIssue({
          path: ["dependencies", index, "pluginId"],
          message: "Plugin cannot depend on itself",
          code: "self_dependency",
        });
      }
    });
  });

const result = pluginManifestSchema.safeParse(input, { mode: "all" });
```

## OpenAPI

```ts
import { toOpenApi } from "@trinacria/schema";

const openApiSchema = toOpenApi(userSchema);
```

## Links

- Repository: [https://github.com/tascaenzo/trinacria](https://github.com/tascaenzo/trinacria)
- Docs: `docs/en/0004-schema.md`
