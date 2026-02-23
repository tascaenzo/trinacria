# Plugin Events (`@trinacria/events`)

Il plugin events aggiunge un event bus interno a Trinacria e supporta trasporti esterni
per architetture distribuite (Redis, RabbitMQ, adapter custom).

Fornisce:

- discovery provider eventi tramite `ProviderKind`
- API runtime (`emit`, `on`, `once`, `off`)
- rebuild dinamico listener quando cambiano i moduli
- layer di astrazione trasporti (`EventTransport`) per microservizi
- opzioni production (retry, idempotenza, validazione, metriche health)

## Installazione

```bash
npm i @trinacria/events @trinacria/core
```

## Avvio rapido (bus interno)

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

## Contratto provider

Un provider scoperto deve implementare:

```ts
interface EventProvider {
  subscriptions(): EventSubscription | readonly EventSubscription[];
}
```

`EventSubscription` supporta:

- `event: string`
- `handler(payload, envelope)`
- `priority?: number` (valori più alti eseguiti prima)
- `once?: boolean`

## API runtime bus

- `emit(event, payload)`
- `on(event, handler, options?)`
- `once(event, handler, options?)`
- `off(event, handler)`
- `listenerCount(event?)`
- `getHealth?()`

## Trasporto esterno (microservizi)

Il plugin può instradare eventi tramite broker passando `transport`.

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

- `true` (default): i listener locali vengono invocati durante `emit`
- `false`: si usa solo il percorso broker (consigliato multi-istanza)

## Adapter transport built-in

### Redis

Opzioni `RedisEventTransport`:

- `publisher` client (`publish(channel, message)`)
- `subscriber` client (`subscribe(channel, onMessage)`, `unsubscribe(...)`)
- `channel?: string` (default: `trinacria:events`)
- `retry?: { connect?, publish? }`
- `onMessageError?: (error, raw) => void`

### RabbitMQ

Opzioni `RabbitMqEventTransport`:

- `channel` (compatibile con channel amqplib)
- `exchange?: string` (default: `trinacria.events`)
- `queueName?: string`
- `routingPattern?: string` (default: `#`)
- `retry?: { connect?, publish? }`
- `usePublisherConfirms?: boolean`
- `deadLetter?: { exchange?: string; routingPrefix?: string }`
- `onConsumeError?: (error, raw) => void`

## Come creare un transport custom

Puoi integrare qualsiasi broker implementando `EventTransport`:

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

Poi lo colleghi al plugin:

```ts
app.use(
  createEventsPlugin({
    transport: new MyBrokerTransport(client),
    dispatchLocalOnEmit: false,
    source: "billing-service",
  }),
);
```

### Checklist implementazione transport

- Decodifica `publishedAt` inbound come `Date`.
- Considera `publish` come at-least-once salvo garanzie più forti del broker.
- Fai in modo che `connect` sia ri-eseguibile in sicurezza (subscribe idempotente o setup protetto).
- Mantieni `disconnect` resiliente anche con connessione parziale.
- Gestisci payload malformati con strategia dead-letter del broker.
- Non assumere exactly-once; abilita `idempotency` nelle opzioni plugin.

## Pattern transport per broker

### Kafka

- Mappa `event.name` su topic, oppure topic unico + header evento.
- Commit offset solo dopo `onEnvelope` completato.
- Usa partition key da id business per preservare ordine per aggregate.
- Mantieni `idempotency` attiva per duplicati da replay/rebalance.

### NATS / JetStream

- Mapping subject: `events.<event.name>`.
- Con JetStream fai ack solo dopo esecuzione handler riuscita.
- Configura retention stream e max-deliver per limiti retry.

### AWS SQS/SNS

- SNS per fan-out, SQS per code consumer.
- Usa message attributes per `name`, `version`, `source`.
- Elimina messaggio SQS solo dopo successo `onEnvelope`.
- Configura redrive policy verso DLQ per poison messages.

### Google Pub/Sub

- Pubblica envelope JSON completo come message data.
- Ack dopo successo `onEnvelope`.
- Regola ack deadline / lease extension per handler lunghi.
- Usa ordering key quando serve ordine stretto.

## Opzioni production (`createEventsPlugin`)

- `retry.connect` / `retry.publish` con policy backoff
- `idempotency` (cache TTL in-memory o `store` custom)
- `validateEnvelope(envelope, context)` per validazione inbound/outbound
- metadati `version` e `headers` negli envelope emessi
- callback telemetria `onHealthChange(health)`
- callback duplicati `onDispatchSkippedDuplicate(envelope)`
- callback errori listener `onListenerError(error, envelope, subscription)`
- `stopOnError?: boolean`

## Health snapshot

```ts
const bus = await app.resolve(EVENT_BUS_TOKEN);
const health = bus.getHealth?.();

// esempio health:
// {
//   connected: true,
//   listeners: 12,
//   metrics: { emitted, dispatched, failed, deduplicated },
//   lastError,
//   lastErrorAt
// }
```

## Comportamento runtime

Startup:

1. il plugin registra `EVENT_BUS_TOKEN` come provider globale
2. scopre provider marcati con `EVENT_PROVIDER_KIND`
3. ricostruisce i listener managed dai moduli attivi
4. connette il transport (se configurato)

Cambi modulo runtime:

- su `registerModule` / `unregisterModule`, i listener vengono ricostruiti

Shutdown:

- disconnette il transport
- pulisce listener managed/runtime

## Best practice per sistemi distribuiti

- usa `dispatchLocalOnEmit: false` in deployment multi-nodo
- valida schema/versione in `validateEnvelope`
- configura idempotenza per gestire delivery at-least-once
- usa publisher confirms e DLQ in RabbitMQ per flussi critici
- esponi metriche `getHealth()` su endpoint health/observability
- mantieni handler idempotenti e sicuri rispetto a side-effect
