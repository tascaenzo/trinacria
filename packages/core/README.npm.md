# @trinacria/core

`@trinacria/core` is the runtime foundation of Trinacria.

It provides:

- typed dependency injection via tokens
- module boundaries (`imports`, `providers`, `exports`)
- plugin lifecycle hooks
- application startup/shutdown orchestration

## Install

```bash
npm i @trinacria/core
```

## Quick start

```ts
import {
  TrinacriaApp,
  createToken,
  defineModule,
  classProvider,
  valueProvider,
} from "@trinacria/core";

type Clock = () => Date;

const CLOCK = createToken<Clock>("CLOCK");
const MESSAGE = createToken<string>("MESSAGE");
const GREETER = createToken<Greeter>("GREETER");

class Greeter {
  constructor(
    private readonly clock: Clock,
    private readonly message: string,
  ) {}

  hello(name: string) {
    return `${this.message}, ${name} - ${this.clock().toISOString()}`;
  }
}

const AppModule = defineModule({
  name: "AppModule",
  providers: [
    valueProvider(CLOCK, () => new Date()),
    valueProvider(MESSAGE, "Hello"),
    classProvider(GREETER, Greeter, [CLOCK, MESSAGE]),
  ],
  exports: [GREETER],
});

const app = new TrinacriaApp();
await app.registerModule(AppModule);
await app.start();

const greeter = await app.resolve(GREETER);
console.log(greeter.hello("Trinacria"));

await app.shutdown();
```

## What to add next

- `@trinacria/http` for HTTP APIs
- `@trinacria/events` for event bus and broker transports
- `@trinacria/cron` for scheduled jobs

## Links

- Repository: [https://github.com/tascaenzo/trinacria](https://github.com/tascaenzo/trinacria)
- Docs: `docs/en` and `docs/it` in the repository.
