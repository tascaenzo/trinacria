import test from "node:test";
import assert from "node:assert/strict";
import {
  TrinacriaApp,
  createToken,
  defineModule,
  type Token,
} from "@trinacria/core";

import {
  EVENT_BUS_TOKEN,
  createEventsPlugin,
  eventProvider,
  type EventBus,
  type EventEnvelope,
  type EventProvider,
  type EventSubscription,
  type EventTransport,
  type ManagedEventBus,
} from "../src";

function withSilencedOutput<T>(run: () => Promise<T> | T): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};

  return Promise.resolve()
    .then(() => run())
    .finally(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    });
}

function createEventProviderModule(
  name: string,
  token: Token<EventProvider>,
  subscriptions: readonly EventSubscription[],
) {
  class EventsProvider implements EventProvider {
    subscriptions() {
      return subscriptions;
    }
  }

  return defineModule({
    name,
    providers: [eventProvider(token, EventsProvider)],
    exports: [token],
  });
}

test("provider subscriptions are discovered and receive emitted events", async () => {
  await withSilencedOutput(async () => {
    let received = 0;

    const TOKEN = createToken<EventProvider>("DISCOVERY_EVENT_PROVIDER");
    const module = createEventProviderModule("EventDiscoveryModule", TOKEN, [
      {
        event: "user.created",
        handler: async () => {
          received += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(createEventsPlugin());
    await app.registerModule(module);
    await app.start();

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    await bus.emit("user.created", { id: 1 });
    assert.equal(received, 1);

    await app.shutdown();
  });
});

test("runtime module register/unregister rebuilds managed listeners", async () => {
  await withSilencedOutput(async () => {
    let received = 0;

    const TOKEN = createToken<EventProvider>("RUNTIME_EVENT_PROVIDER");
    const module = createEventProviderModule("RuntimeEventsModule", TOKEN, [
      {
        event: "invoice.paid",
        handler: async () => {
          received += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(createEventsPlugin());
    await app.start();

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    await bus.emit("invoice.paid", { id: 1 });
    assert.equal(received, 0);

    await app.registerModule(module);
    await bus.emit("invoice.paid", { id: 2 });
    assert.equal(received, 1);

    await app.unregisterModule(module);
    await bus.emit("invoice.paid", { id: 3 });
    assert.equal(received, 1);

    await app.shutdown();
  });
});

test("runtime API supports priority, once and off", async () => {
  await withSilencedOutput(async () => {
    const app = new TrinacriaApp();
    app.use(createEventsPlugin());
    await app.start();

    const bus = (await app.resolve(EVENT_BUS_TOKEN)) as EventBus;
    const order: string[] = [];

    const normal = async () => {
      order.push("normal");
    };

    const unsubscribeHigh = bus.on(
      "task.done",
      async () => {
        order.push("high");
      },
      { priority: 10 },
    );

    bus.once(
      "task.done",
      async () => {
        order.push("once");
      },
      { priority: 5 },
    );

    bus.on("task.done", normal, { priority: 0 });

    await bus.emit("task.done", { id: 1 });
    await bus.emit("task.done", { id: 2 });

    assert.deepEqual(order, ["high", "once", "normal", "high", "normal"]);
    assert.equal(bus.listenerCount("task.done"), 2);

    bus.off("task.done", normal);
    assert.equal(bus.listenerCount("task.done"), 1);

    unsubscribeHigh();
    assert.equal(bus.listenerCount("task.done"), 0);

    await app.shutdown();
  });
});

test("listener errors are forwarded to option hook", async () => {
  await withSilencedOutput(async () => {
    const errors: string[] = [];
    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        onListenerError: (error, envelope) => {
          errors.push(`${envelope.name}:${String((error as Error).message)}`);
        },
      }),
    );

    await app.start();

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    bus.on("job.failed", async () => {
      throw new Error("boom");
    });

    await bus.emit("job.failed", { id: 1 });

    assert.deepEqual(errors, ["job.failed:boom"]);
    await app.shutdown();
  });
});

test("transport abstraction can deliver events via external bus adapter", async () => {
  await withSilencedOutput(async () => {
    let received = 0;

    const TOKEN = createToken<EventProvider>("TRANSPORT_EVENT_PROVIDER");
    const module = createEventProviderModule("TransportEventsModule", TOKEN, [
      {
        event: "payment.captured",
        handler: async () => {
          received += 1;
        },
      },
    ]);

    class LoopbackTransport implements EventTransport {
      private handler?: (envelope: EventEnvelope) => Promise<void> | void;

      connect(
        onEnvelope: (envelope: EventEnvelope) => Promise<void> | void,
      ): void {
        this.handler = onEnvelope;
      }

      async publish(envelope: EventEnvelope): Promise<void> {
        await this.handler?.(envelope);
      }
    }

    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        transport: new LoopbackTransport(),
        dispatchLocalOnEmit: false,
      }),
    );

    await app.registerModule(module);
    await app.start();

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    await bus.emit("payment.captured", { id: 1 });

    assert.equal(received, 1);
    await app.shutdown();
  });
});

test("custom managed bus can be injected into events plugin", async () => {
  await withSilencedOutput(async () => {
    class FakeManagedBus implements ManagedEventBus {
      private subscriptions: readonly EventSubscription[] = [];
      startCalls = 0;
      stopCalls = 0;

      async start(): Promise<void> {
        this.startCalls += 1;
      }

      async stop(): Promise<void> {
        this.stopCalls += 1;
      }

      clear(): void {
        this.subscriptions = [];
      }

      replaceManagedSubscriptions(
        subscriptions: readonly EventSubscription[],
      ): void {
        this.subscriptions = subscriptions;
      }

      async emit<TPayload>(_event: string, _payload: TPayload): Promise<void> {}

      on<_TPayload>(): () => void {
        return () => {};
      }

      once<_TPayload>(): () => void {
        return () => {};
      }

      off<_TPayload>(): void {}

      listenerCount(): number {
        return this.subscriptions.length;
      }
    }

    const TOKEN = createToken<EventProvider>("CUSTOM_BUS_PROVIDER");
    const module = createEventProviderModule("CustomBusModule", TOKEN, [
      {
        event: "user.deleted",
        handler: async () => {},
      },
      {
        event: "user.restored",
        handler: async () => {},
      },
    ]);

    const fakeBus = new FakeManagedBus();
    const app = new TrinacriaApp();
    app.use(createEventsPlugin({ bus: fakeBus }));
    await app.registerModule(module);
    await app.start();

    const resolved = await app.resolve(EVENT_BUS_TOKEN);
    assert.equal(resolved, fakeBus);
    assert.equal(fakeBus.startCalls, 1);
    assert.equal(fakeBus.listenerCount(), 2);

    await app.shutdown();
    assert.equal(fakeBus.stopCalls, 1);
    assert.equal(fakeBus.listenerCount(), 0);
  });
});

test("inbound deduplication skips duplicated envelope ids", async () => {
  await withSilencedOutput(async () => {
    let received = 0;
    let onEnvelope:
      | ((envelope: EventEnvelope) => Promise<void> | void)
      | undefined;

    class ManualTransport implements EventTransport {
      connect(
        handler: (envelope: EventEnvelope) => Promise<void> | void,
      ): void {
        onEnvelope = handler;
      }
      async publish(): Promise<void> {}
    }

    const TOKEN = createToken<EventProvider>("DEDUP_PROVIDER");
    const module = createEventProviderModule("DedupModule", TOKEN, [
      {
        event: "order.confirmed",
        handler: async () => {
          received += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        transport: new ManualTransport(),
        dispatchLocalOnEmit: false,
      }),
    );
    await app.registerModule(module);
    await app.start();

    const envelope: EventEnvelope = {
      id: "dup-1",
      name: "order.confirmed",
      payload: { id: 1 },
      publishedAt: new Date(),
    };

    await onEnvelope?.(envelope);
    await onEnvelope?.(envelope);

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    assert.equal(received, 1);
    assert.equal(bus.getHealth?.().metrics.deduplicated, 1);

    await app.shutdown();
  });
});

test("validator rejects outbound envelope and connect retry can recover", async () => {
  await withSilencedOutput(async () => {
    let connectAttempts = 0;

    class FlakyConnectTransport implements EventTransport {
      connect(): void {
        connectAttempts += 1;
        if (connectAttempts < 3) {
          throw new Error("connect failed");
        }
      }
      async publish(): Promise<void> {}
    }

    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        transport: new FlakyConnectTransport(),
        retry: {
          connect: {
            maxAttempts: 3,
            baseDelayMs: 1,
            maxDelayMs: 2,
            multiplier: 1,
            jitterMs: 0,
          },
        },
        validateEnvelope: async (envelope) => {
          if (envelope.name === "forbidden.event") {
            throw new Error("schema validation failed");
          }
        },
      }),
    );
    await app.start();
    assert.equal(connectAttempts, 3);

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    await assert.rejects(
      () => bus.emit("forbidden.event", { id: 1 }),
      /schema validation failed/,
    );

    await app.shutdown();
  });
});

test("stopOnError interrupts dispatch and updates health error fields", async () => {
  await withSilencedOutput(async () => {
    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        stopOnError: true,
      }),
    );
    await app.start();

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    const calls: string[] = [];

    bus.on("email.send", async () => {
      calls.push("first");
      throw new Error("listener failed");
    });

    bus.on("email.send", async () => {
      calls.push("second");
    });

    await assert.rejects(() => bus.emit("email.send", {}), /listener failed/);
    assert.deepEqual(calls, ["first"]);

    const health = bus.getHealth?.();
    assert.equal(typeof health?.lastError, "string");
    assert.ok(health?.lastError?.includes("listener failed"));
    assert.ok(health?.lastErrorAt instanceof Date);

    await app.shutdown();
  });
});

test("custom idempotency store and duplicate callback are used for inbound events", async () => {
  await withSilencedOutput(async () => {
    let onEnvelope:
      | ((envelope: EventEnvelope) => Promise<void> | void)
      | undefined;
    let received = 0;
    const duplicates: string[] = [];

    const seen = new Set<string>();
    const store = {
      async has(eventId: string) {
        return seen.has(eventId);
      },
      async set(eventId: string) {
        seen.add(eventId);
      },
    };

    class ManualTransport implements EventTransport {
      connect(
        handler: (envelope: EventEnvelope) => Promise<void> | void,
      ): void {
        onEnvelope = handler;
      }
      async publish(): Promise<void> {}
    }

    const TOKEN = createToken<EventProvider>("STORE_DEDUP_PROVIDER");
    const module = createEventProviderModule("StoreDedupModule", TOKEN, [
      {
        event: "invoice.created",
        handler: async () => {
          received += 1;
        },
      },
    ]);

    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        transport: new ManualTransport(),
        dispatchLocalOnEmit: false,
        idempotency: {
          ttlMs: 100,
          store,
        },
        onDispatchSkippedDuplicate: (envelope) => duplicates.push(envelope.id),
      }),
    );
    await app.registerModule(module);
    await app.start();

    await onEnvelope?.({
      id: "event-1",
      name: "invoice.created",
      payload: { id: 1 },
      publishedAt: new Date(),
    });
    await onEnvelope?.({
      id: "event-1",
      name: "invoice.created",
      payload: { id: 1 },
      publishedAt: new Date(),
    });

    assert.equal(received, 1);
    assert.deepEqual(duplicates, ["event-1"]);

    await app.shutdown();
  });
});

test("publish retry succeeds after transient transport failure", async () => {
  await withSilencedOutput(async () => {
    let publishAttempts = 0;

    class FlakyPublishTransport implements EventTransport {
      connect(): void {}

      async publish(): Promise<void> {
        publishAttempts += 1;
        if (publishAttempts < 3) {
          throw new Error("temporary publish failure");
        }
      }
    }

    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        transport: new FlakyPublishTransport(),
        dispatchLocalOnEmit: false,
        retry: {
          publish: {
            maxAttempts: 3,
            baseDelayMs: 1,
            maxDelayMs: 2,
            multiplier: 1,
            jitterMs: 0,
          },
        },
      }),
    );
    await app.start();

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    await bus.emit("cache.invalidate", { key: "users" });

    assert.equal(publishAttempts, 3);
    await app.shutdown();
  });
});

test("onHealthChange callback receives runtime updates", async () => {
  await withSilencedOutput(async () => {
    const updates: number[] = [];

    const app = new TrinacriaApp();
    app.use(
      createEventsPlugin({
        onHealthChange: (health) => {
          updates.push(health.listeners);
        },
      }),
    );
    await app.start();

    const bus = await app.resolve(EVENT_BUS_TOKEN);
    const off = bus.on("health.event", async () => {});
    await bus.emit("health.event", {});
    off();

    assert.ok(updates.length >= 2);
    await app.shutdown();
  });
});
