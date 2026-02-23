# Events Plugin (`@trinacria/events`)

The events plugin adds an internal event bus to Trinacria and supports external transports
for distributed architectures (Redis, RabbitMQ, custom broker adapters).

It provides:

- event provider discovery through `ProviderKind`
- runtime API (`emit`, `on`, `once`, `off`)
- dynamic listener rebuild when modules change
- transport abstraction (`EventTransport`) for microservices
- production options (retry, idempotency, validation, health metrics)

## Installation

```bash
npm i @trinacria/events @trinacria/core
```

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

## Provider contract

A discovered provider must implement:

```ts
interface EventProvider {
  subscriptions(): EventSubscription | readonly EventSubscription[];
}
```

`EventSubscription` supports:

- `event: string`
- `handler(payload, envelope)`
- `priority?: number` (higher runs first)
- `once?: boolean`

## Runtime bus API

- `emit(event, payload)`
- `on(event, handler, options?)`
- `once(event, handler, options?)`
- `off(event, handler)`
- `listenerCount(event?)`
- `getHealth?()`

## External transport (microservices)

The plugin can route events through a broker by passing `transport`.

```ts
import { createEventsPlugin, RedisEventTransport } from "@trinacria/events";

app.use(
  createEventsPlugin({
    transport: new RedisEventTransport({
      publisher,
      subscriber,
      channel: "trinacria:events",
    }),
    source: "users-service",
    dispatchLocalOnEmit: false,
  }),
);
```

`dispatchLocalOnEmit`:

- `true` (default): local listeners are called during `emit`
- `false`: only broker delivery path is used (recommended for multi-instance)

## Built-in transport adapters

### Redis

`RedisEventTransport` options:

- `publisher` client (`publish(channel, message)`)
- `subscriber` client (`subscribe(channel, onMessage)`, `unsubscribe(...)`)
- `channel?: string` (default: `trinacria:events`)
- `retry?: { connect?, publish? }`
- `onMessageError?: (error, raw) => void`

### RabbitMQ

`RabbitMqEventTransport` options:

- `channel` (amqplib-like channel)
- `exchange?: string` (default: `trinacria.events`)
- `queueName?: string`
- `routingPattern?: string` (default: `#`)
- `retry?: { connect?, publish? }`
- `usePublisherConfirms?: boolean`
- `deadLetter?: { exchange?: string; routingPrefix?: string }`
- `onConsumeError?: (error, raw) => void`

## How to build a custom transport

Any broker can be integrated by implementing `EventTransport`:

```ts
import type { EventEnvelope, EventTransport } from "@trinacria/events";

export class MyBrokerTransport implements EventTransport {
  constructor(private readonly client: MyBrokerClient) {}

  async connect(onEnvelope: (envelope: EventEnvelope) => Promise<void> | void) {
    await this.client.connect();
    await this.client.subscribe("events", async (raw: string) => {
      const envelope = JSON.parse(raw) as EventEnvelope;
      await onEnvelope({
        ...envelope,
        publishedAt: new Date(String(envelope.publishedAt)),
      });
    });
  }

  async publish(envelope: EventEnvelope) {
    await this.client.publish("events", JSON.stringify(envelope));
  }

  async disconnect() {
    await this.client.close();
  }
}
```

Then wire it into the plugin:

```ts
app.use(
  createEventsPlugin({
    transport: new MyBrokerTransport(client),
    dispatchLocalOnEmit: false,
    source: "billing-service",
  }),
);
```

### Transport implementation checklist

- Decode inbound `publishedAt` as `Date`.
- Treat `publish` as at-least-once unless your broker guarantees stronger semantics.
- Ensure `connect` can be retried safely (idempotent subscribe or guarded setup).
- Keep `disconnect` graceful and safe when partially connected.
- Surface malformed payloads via broker-specific dead-letter strategy.
- Do not rely on exactly-once delivery; use `idempotency` in plugin options.

## Transport patterns by broker

### Kafka

- Map `event.name` to topic, or use one topic plus event-name header.
- Commit offsets only after `onEnvelope` completes.
- Use partition key from business id to preserve per-aggregate order.
- Keep plugin `idempotency` enabled for replay/rebalance duplicates.

### NATS / JetStream

- Subject mapping: `events.<event.name>`.
- With JetStream, ack only after successful handler execution.
- Configure stream retention and max-deliver for retry limits.

### AWS SQS/SNS

- SNS for fan-out, SQS for consumer queues.
- Use message attributes for `name`, `version`, `source`.
- Delete SQS message only after `onEnvelope` succeeds.
- Use DLQ redrive policy for poison messages.

### Google Pub/Sub

- Publish full envelope JSON as message data.
- Ack after successful `onEnvelope`.
- Tune ack deadline / lease extension for long handlers.
- Use ordering keys when strict ordering is required.

## Production options (`createEventsPlugin`)

- `retry.connect` / `retry.publish` with backoff policy
- `idempotency` (in-memory TTL cache or custom `store`)
- `validateEnvelope(envelope, context)` for inbound/outbound validation
- `version` and `headers` metadata in emitted envelopes
- `onHealthChange(health)` telemetry callback
- `onDispatchSkippedDuplicate(envelope)` duplicate detection callback
- `onListenerError(error, envelope, subscription)` listener failure callback
- `stopOnError?: boolean`

## Health snapshot

```ts
const bus = await app.resolve(EVENT_BUS_TOKEN);
const health = bus.getHealth?.();

// health example:
// {
//   connected: true,
//   listeners: 12,
//   metrics: { emitted, dispatched, failed, deduplicated },
//   lastError,
//   lastErrorAt
// }
```

## Runtime behavior

Startup:

1. plugin registers `EVENT_BUS_TOKEN` as global provider
2. plugin discovers providers tagged with `EVENT_PROVIDER_KIND`
3. managed listeners are rebuilt from active modules
4. optional transport is connected

Runtime module changes:

- on `registerModule` / `unregisterModule`, listeners are rebuilt

Shutdown:

- transport is disconnected
- managed/runtime listeners are cleared

## Best practices for distributed systems

- use `dispatchLocalOnEmit: false` in multi-node deployments
- enforce schema/version in `validateEnvelope`
- configure idempotency to handle at-least-once delivery
- use RabbitMQ confirms and DLQ for critical flows
- expose `getHealth()` metrics in observability/health endpoints
- keep handlers side-effect safe and idempotent
