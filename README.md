# Trinacria

<p align="center">
  <img src="./docs/assets/logo_transparent.png" alt="Trinacria logo" width="220" />
</p>

A modular, type-safe Dependency Injection engine for TypeScript applications and infrastructure runtimes.

## Why Trinacria?

Trinacria is an engine, not a framework.

It provides the architectural core for building systems with explicit dependency graphs, strict module boundaries, and plugin-based extensions. It does not prescribe transport layers, routing style, persistence strategy, or application conventions.

If you want full control over architecture without decorators, reflection, or hidden container behavior, Trinacria is designed for that use case.

## Philosophy

Trinacria is built around explicitness and deterministic behavior:

- Dependencies are declared through typed tokens.
- Providers are registered with explicit construction rules.
- Modules define clear visibility (`imports`, `providers`, `exports`).
- Plugins extend runtime behavior through lifecycle hooks.
- No decorators, no metadata reflection, no implicit auto-wiring.

The core stays small and focused so higher-level capabilities (HTTP, events, cron, CLI) can be composed as plugins or separate packages.

## Installation

```bash
npm install @trinacria/core
```

## Quick Start (minimal example)

```ts
import {
  TrinacriaApp,
  createToken,
  defineModule,
  classProvider,
  valueProvider,
} from "@trinacria/core";

type Clock = () => Date;

const CLOCK_TOKEN = createToken<Clock>("CLOCK");
const GREETING_TOKEN = createToken<string>("GREETING");
const GREETER_TOKEN = createToken<Greeter>("GREETER");

class Greeter {
  constructor(
    private readonly clock: Clock,
    private readonly greeting: string,
  ) {}

  sayHello(name: string): string {
    return `${this.greeting}, ${name}. ${this.clock().toISOString()}`;
  }
}

const AppModule = defineModule({
  name: "AppModule",
  providers: [
    valueProvider(CLOCK_TOKEN, () => new Date()),
    valueProvider(GREETING_TOKEN, "Hello"),
    classProvider(GREETER_TOKEN, Greeter, [CLOCK_TOKEN, GREETING_TOKEN]),
  ],
  exports: [GREETER_TOKEN],
});

async function bootstrap() {
  const app = new TrinacriaApp();

  await app.registerModule(AppModule);
  await app.start();

  const greeter = await app.resolve(GREETER_TOKEN);
  console.log(greeter.sayHello("Trinacria"));

  await app.shutdown();
}

void bootstrap();
```

## Core Concepts

### Token

A `Token<T>` is a strongly typed dependency identifier created with `createToken<T>()`.
Tokens replace string keys and keep dependency contracts type-safe at compile time.

### Providers (class, value, factory)

Trinacria supports three provider types:

- `classProvider(token, ClassCtor, deps?)`
- `valueProvider(token, value)`
- `factoryProvider(token, factory, deps?)`

All dependencies are explicit through `deps`. There is no constructor metadata reflection.

### Lifecycle

Lifecycle has clear phases:

1. Configuration (`use`, `registerModule`, `registerGlobalProvider`)
2. Bootstrap (`start`)
3. Runtime (`resolve`, runtime module operations)
4. Shutdown (`shutdown`)

Providers may implement:

- `onInit()`
- `onDestroy()`

Plugins may implement:

- `onRegister(app)`
- `onInit(app)`
- `onModuleRegistered(module, app)`
- `onModuleUnregistered(module, app)`
- `onDestroy(app)`

### Plugin system

Plugins are plain objects declared with `definePlugin(...)`.
They extend behavior without modifying core internals.

`ProviderKind` (`createProviderKind<T>()`) allows plugins to discover compatible providers in a type-safe way.

## Modular Architecture Example

```ts
import {
  createToken,
  defineModule,
  classProvider,
  factoryProvider,
} from "@trinacria/core";

interface UserRepository {
  findById(id: string): Promise<{ id: string; name: string } | null>;
}

class PgUserRepository implements UserRepository {
  async findById(id: string) {
    return { id, name: "Ada" };
  }
}

class UserService {
  constructor(private readonly repo: UserRepository) {}
  getUser(id: string) {
    return this.repo.findById(id);
  }
}

const USER_REPO_TOKEN = createToken<UserRepository>("USER_REPO");
const USER_SERVICE_TOKEN = createToken<UserService>("USER_SERVICE");

const InfraModule = defineModule({
  name: "InfraModule",
  providers: [classProvider(USER_REPO_TOKEN, PgUserRepository)],
  exports: [USER_REPO_TOKEN],
});

const UserModule = defineModule({
  name: "UserModule",
  imports: [InfraModule],
  providers: [
    factoryProvider(USER_SERVICE_TOKEN, (repo) => new UserService(repo), [
      USER_REPO_TOKEN,
    ]),
  ],
  exports: [USER_SERVICE_TOKEN],
});
```

This keeps infrastructure and domain services separated while preserving explicit contracts.

## Testing

Trinacria improves testing by making dependencies explicit and replaceable via tokens.

```ts
import {
  TrinacriaApp,
  defineModule,
  valueProvider,
  createToken,
} from "@trinacria/core";

interface Mailer {
  send(to: string): Promise<void>;
}

const MAILER_TOKEN = createToken<Mailer>("MAILER");
const SENT_TOKEN = createToken<string[]>("SENT");

const sent: string[] = [];
const fakeMailer: Mailer = {
  async send(to: string) {
    sent.push(to);
  },
};

const TestModule = defineModule({
  name: "TestModule",
  providers: [
    valueProvider(MAILER_TOKEN, fakeMailer),
    valueProvider(SENT_TOKEN, sent),
  ],
  exports: [MAILER_TOKEN, SENT_TOKEN],
});

async function runTest() {
  const app = new TrinacriaApp();
  await app.registerModule(TestModule);
  await app.start();

  const mailer = await app.resolve(MAILER_TOKEN);
  await mailer.send("team@example.com");

  const calls = await app.resolve(SENT_TOKEN);
  console.assert(calls.length === 1);

  await app.shutdown();
}
```

No decorator setup, no reflection mocks, no hidden container overrides.

## Comparison Table

| Topic                  | Trinacria                         | Typical decorator-based DI                    |
| ---------------------- | --------------------------------- | --------------------------------------------- |
| Dependency declaration | Explicit tokens and provider deps | Implicit constructor metadata and decorators  |
| Runtime reflection     | Not required                      | Usually required                              |
| Module boundaries      | Explicit `imports` / `exports`    | Often mixed with framework module conventions |
| Extensibility model    | Plugin lifecycle + provider kinds | Framework extension points, often coupled     |
| Container behavior     | Deterministic and visible in code | May rely on implicit scanning/registration    |
| Architectural coupling | Engine-first, transport-agnostic  | Frequently tied to framework runtime          |
| Testing style          | Token-level provider replacement  | Often needs framework testing harnesses       |

## Use Cases

- Building custom backend platforms on TypeScript
- Creating internal frameworks with strict module contracts
- Writing reusable infrastructure libraries with DI
- Implementing plugin-based runtimes (HTTP, events, cron, CLI)
- Teams that prefer explicit architecture over convention-heavy abstractions

## Roadmap

- Stabilize and document the public API toward a 1.0 baseline
- Expand architecture documentation and advanced design guides
- Add more end-to-end example applications in `apps/`
- Continue hardening plugin packages (`@trinacria/http`, `@trinacria/events`, `@trinacria/cron`) through tests and runtime guarantees

## Contributing

Contributions are welcome.

1. Fork and create a feature branch.
2. Keep changes focused and explicit.
3. Add or update tests for behavior changes.
4. Run quality checks before opening a PR.

Common commands:

```bash
npm run build:packages
npm run test:packages
npm run coverage:all
npm run precommit:check
```

Repository documentation:

- `docs/en/README.md`
- `docs/it/README.md`
- `apps/README.md`
- `docs/en/1002-repository-publish-artifacts.md` (library publish/artifact pipeline)
- `docs/it/1002-repository-publish-artifacts.md` (pipeline publish librerie/artifact)

Release channels:

- publish flow via `npm run release:npm` (guided)
- CLI template smoke workflow: `.github/workflows/cli-template-smoke.yml`

## License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE) file for details.
