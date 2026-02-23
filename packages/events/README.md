# @trinacria/events - Implementation Guide

`@trinacria/events` is Trinacria's event-bus plugin.
It provides an in-process event bus and a transport abstraction for distributed delivery
(Redis, RabbitMQ, or custom adapters).

## What this package is responsible for

- plugin lifecycle integration with `TrinacriaApp`
- event provider discovery via `ProviderKind`
- runtime event API (`emit`, `on`, `once`, `off`)
- optional external transport integration (`EventTransport`)
- production hooks: retry, validation, idempotency, health metrics

It does **not** own business event schemas or domain-specific routing policies.

## Directory structure

```text
packages/events/
  src/
    bus/
      internal-event-bus.ts
    contracts/
      types.ts
      index.ts
    provider/
      kind.ts
      event-provider.ts
      index.ts
    transports/
      redis-event-transport.ts
      rabbitmq-event-transport.ts
      index.ts
    events.plugin.ts
    index.ts
  test/
    events.plugin.test.ts
    transports.unit.test.ts
```

## File-by-file summary

### `src/events.plugin.ts`

- package entrypoint for plugin lifecycle (`createEventsPlugin`)
- registers `EVENT_BUS_TOKEN` as a global provider during `onRegister`
- rebuilds managed subscriptions on startup and runtime module changes
- starts/stops bus transport when available

### `src/bus/internal-event-bus.ts`

- internal implementation of `ManagedEventBus`
- listener registry with priority and `once` semantics
- local dispatch and optional transport publish path
- health snapshot support (`getHealth`)
- retry execution for transport `connect`/`publish`
- inbound deduplication with in-memory cache or custom idempotency store
- envelope validation hooks for inbound/outbound flows

### `src/contracts/types.ts`

Defines all public contracts:

- `EventBus`, `ManagedEventBus`
- `EventProvider`, `EventSubscription`
- `EventEnvelope`
- `EventTransport`
- plugin options (`EventPluginOptions`)
- production contracts (`RetryPolicy`, `EventIdempotencyStore`, `EventBusHealth`)

### `src/provider/kind.ts`

- declares `EVENT_PROVIDER_KIND` used by the plugin to discover event providers

### `src/provider/event-provider.ts`

- helper factory `eventProvider(...)` to register provider classes with `EVENT_PROVIDER_KIND`

### `src/transports/redis-event-transport.ts`

- Redis adapter implementing `EventTransport`
- publish/subscribe integration through lightweight client interfaces
- retry support for connect/publish
- message parse/error callback hook

### `src/transports/rabbitmq-event-transport.ts`

- RabbitMQ adapter implementing `EventTransport`
- topic exchange publish/consume flow
- optional publisher confirms
- optional dead-letter routing on consume failures
- retry support for connect/publish

### `src/index.ts`

- public barrel exports for plugin, providers, contracts, and transports

### `test/events.plugin.test.ts`

- plugin lifecycle tests
- runtime subscription rebuild tests
- dispatch behavior tests (`priority`, `once`, `off`)
- production option tests (`retry`, `idempotency`, `stopOnError`, health callbacks)

### `test/transports.unit.test.ts`

- Redis transport tests (connect/publish, retries, parse error path)
- RabbitMQ transport tests (publish/consume, confirms, DLQ, nack fallback)

## Quick start (internal bus)

```ts
import { TrinacriaApp, createToken, defineModule } from "@trinacria/core";
import {
  createEventsPlugin,
  eventProvider,
  EVENT_BUS_TOKEN,
  type EventProvider,
} from "@trinacria/events";

const USER_EVENTS = createToken<EventProvider>("USER_EVENTS");

class UserEventsProvider implements EventProvider {
  subscriptions() {
    return {
      event: "user.created",
      handler: async (payload) => {
        console.log("user.created", payload);
      },
    };
  }
}

const UserEventsModule = defineModule({
  name: "UserEventsModule",
  providers: [eventProvider(USER_EVENTS, UserEventsProvider)],
  exports: [USER_EVENTS],
});

const app = new TrinacriaApp();
app.use(createEventsPlugin());
await app.registerModule(UserEventsModule);
await app.start();

const bus = await app.resolve(EVENT_BUS_TOKEN);
await bus.emit("user.created", { id: 1 });
```

## External transport usage

```ts
import { createEventsPlugin, RedisEventTransport } from "@trinacria/events";

app.use(
  createEventsPlugin({
    transport: new RedisEventTransport({ publisher, subscriber }),
    source: "users-service",
    dispatchLocalOnEmit: false,
  }),
);
```

## Production options (recommended)

```ts
app.use(
  createEventsPlugin({
    transport,
    source: "users-service",
    version: 1,
    headers: { tenant: "acme" },
    dispatchLocalOnEmit: false,
    retry: {
      connect: { maxAttempts: 5, baseDelayMs: 200, multiplier: 2 },
      publish: { maxAttempts: 3, baseDelayMs: 100, multiplier: 2 },
    },
    idempotency: {
      ttlMs: 120_000,
      maxEntries: 50_000,
      // store: customSharedStore,
    },
    validateEnvelope: (envelope, context) => {
      // validate schema/version and throw on invalid payload
    },
    onHealthChange: (health) => {
      console.log(health);
    },
  }),
);
```

## Custom transport contract

Implement `EventTransport`:

```ts
interface EventTransport {
  connect(onEnvelope: (envelope: EventEnvelope) => Promise<void> | void): Promise<void> | void;
  publish(envelope: EventEnvelope): Promise<void> | void;
  disconnect?(): Promise<void> | void;
}
```

## Runtime flow

1. plugin registers `EVENT_BUS_TOKEN`
2. plugin discovers providers marked by `EVENT_PROVIDER_KIND`
3. bus rebuilds managed subscriptions
4. transport connects (if configured)
5. events are emitted and dispatched (local, transport, or both)
6. on shutdown, transport disconnects and listeners are cleared

## Best practices

- Use `dispatchLocalOnEmit: false` in multi-node deployments.
- Keep handlers idempotent (at-least-once delivery is common).
- Enforce envelope validation and versioning.
- Use shared idempotency store when multiple consumers process the same stream.
- Expose `bus.getHealth?.()` in health/observability endpoints.
