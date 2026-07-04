# @trinacria/events

`@trinacria/events` adds an event bus plugin to Trinacria.

It provides:

- in-process event bus
- runtime API (`emit`, `on`, `once`, `off`)
- provider discovery for subscriptions
- optional Redis/RabbitMQ transports

## Install

```bash
npm i @trinacria/events @trinacria/core
```

## Quick start

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
        console.log("received", payload);
      },
    };
  }
}

const EventsModule = defineModule({
  name: "EventsModule",
  providers: [eventProvider(USER_EVENTS, UserEventsProvider)],
  exports: [USER_EVENTS],
});

const app = new TrinacriaApp();
app.use(createEventsPlugin());
await app.registerModule(EventsModule);
await app.start();

const bus = await app.resolve(EVENT_BUS_TOKEN);
await bus.emit("user.created", { id: 1 });
```

## Transports

- `RedisEventTransport`
- `RabbitMqEventTransport`

## Links

- Repository: [https://github.com/tascaenzo/trinacria](https://github.com/tascaenzo/trinacria)
- Docs: `docs/en/0006-events-plugin.md`
