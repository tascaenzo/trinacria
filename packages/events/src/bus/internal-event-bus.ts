import type {
  EventBusHealth,
  EventEnvelope,
  EventHandler,
  EventIdempotencyStore,
  EventListenerOptions,
  EventSubscription,
  EventTransport,
  EventUnsubscribe,
  ManagedEventBus,
  RetryPolicy,
} from "../contracts";

type ListenerSource = "runtime" | "managed";

interface ListenerRecord {
  readonly id: number;
  readonly event: string;
  readonly handler: EventHandler;
  readonly priority: number;
  readonly once: boolean;
  readonly source: ListenerSource;
}

interface InternalEventBusOptions {
  stopOnError?: boolean;
  onListenerError?: (
    error: unknown,
    envelope: EventEnvelope,
    subscription: EventSubscription,
  ) => void;
  onDispatchSkippedDuplicate?: (envelope: EventEnvelope) => void;
  onHealthChange?: (health: EventBusHealth) => void;
  validateEnvelope?: (
    envelope: EventEnvelope,
    context: { direction: "inbound" | "outbound" },
  ) => Promise<void> | void;
  transport?: EventTransport;
  dispatchLocalOnEmit?: boolean;
  source?: string;
  version?: number;
  headers?: Record<string, string>;
  connectRetry?: RetryPolicy;
  publishRetry?: RetryPolicy;
  idempotency?: {
    ttlMs?: number;
    maxEntries?: number;
    store?: EventIdempotencyStore;
  };
}

export class InternalEventBus implements ManagedEventBus {
  private readonly listenersByEvent = new Map<string, ListenerRecord[]>();
  private nextListenerId = 1;
  private connected = false;
  private readonly metrics = {
    emitted: 0,
    dispatched: 0,
    failed: 0,
    deduplicated: 0,
  };
  private lastError?: string;
  private lastErrorAt?: Date;
  private readonly dedupTtlMs: number;
  private readonly dedupMaxEntries: number;
  private readonly inMemoryDedup = new Map<string, number>();

  constructor(private readonly options: InternalEventBusOptions = {}) {
    this.dedupTtlMs = options.idempotency?.ttlMs ?? 60_000;
    this.dedupMaxEntries = options.idempotency?.maxEntries ?? 10_000;
  }

  on<TPayload>(
    event: string,
    handler: EventHandler<TPayload>,
    options?: EventListenerOptions,
  ): EventUnsubscribe {
    return this.addListener(event, handler as EventHandler, {
      source: "runtime",
      once: options?.once ?? false,
      priority: options?.priority,
    });
  }

  once<TPayload>(
    event: string,
    handler: EventHandler<TPayload>,
    options?: Omit<EventListenerOptions, "once">,
  ): EventUnsubscribe {
    return this.addListener(event, handler as EventHandler, {
      source: "runtime",
      once: true,
      priority: options?.priority,
    });
  }

  off<TPayload>(event: string, handler: EventHandler<TPayload>): void {
    const listeners = this.listenersByEvent.get(event);
    if (!listeners || listeners.length === 0) {
      return;
    }

    const filtered = listeners.filter(
      (entry) => entry.handler !== (handler as EventHandler),
    );

    if (filtered.length === listeners.length) {
      return;
    }

    this.setListeners(event, filtered);
    this.emitHealthChange();
  }

  async emit<TPayload>(event: string, payload: TPayload): Promise<void> {
    const envelope: EventEnvelope<TPayload> = {
      id: crypto.randomUUID(),
      name: event,
      payload,
      publishedAt: new Date(),
      source: this.options.source,
      version: this.options.version,
      headers: this.options.headers,
    };

    await this.options.validateEnvelope?.(envelope, { direction: "outbound" });

    this.metrics.emitted += 1;

    if (this.options.transport) {
      await withRetry(
        () => this.options.transport!.publish(envelope),
        this.options.publishRetry,
      );
    }

    if (!this.options.transport || this.options.dispatchLocalOnEmit !== false) {
      await this.dispatch(envelope, "outbound");
    }

    this.emitHealthChange();
  }

  listenerCount(event?: string): number {
    if (event) {
      return this.listenersByEvent.get(event)?.length ?? 0;
    }

    let total = 0;
    for (const listeners of this.listenersByEvent.values()) {
      total += listeners.length;
    }

    return total;
  }

  getHealth(): EventBusHealth {
    return {
      connected: !this.options.transport || this.connected,
      listeners: this.listenerCount(),
      metrics: { ...this.metrics },
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
    };
  }

  async start(): Promise<void> {
    if (!this.options.transport || this.connected) {
      return;
    }

    await withRetry(
      () =>
        this.options.transport!.connect((envelope) =>
          this.dispatch(envelope, "inbound"),
        ),
      this.options.connectRetry,
    );

    this.connected = true;
    this.emitHealthChange();
  }

  async stop(): Promise<void> {
    if (!this.options.transport || !this.connected) {
      return;
    }

    await this.options.transport.disconnect?.();
    this.connected = false;
    this.emitHealthChange();
  }

  replaceManagedSubscriptions(
    subscriptions: readonly EventSubscription[],
  ): void {
    for (const [event, listeners] of this.listenersByEvent.entries()) {
      const runtimeOnly = listeners.filter(
        (entry) => entry.source === "runtime",
      );
      this.setListeners(event, runtimeOnly);
    }

    for (const subscription of subscriptions) {
      this.addListener(subscription.event, subscription.handler, {
        source: "managed",
        priority: subscription.priority,
        once: subscription.once ?? false,
      });
    }

    this.emitHealthChange();
  }

  clear(): void {
    this.listenersByEvent.clear();
    this.inMemoryDedup.clear();
    this.emitHealthChange();
  }

  private async dispatch<TPayload>(
    envelope: EventEnvelope<TPayload>,
    direction: "inbound" | "outbound",
  ): Promise<void> {
    await this.options.validateEnvelope?.(envelope, { direction });

    if (direction === "inbound") {
      const isDuplicate = await this.isDuplicate(envelope.id);
      if (isDuplicate) {
        this.metrics.deduplicated += 1;
        this.options.onDispatchSkippedDuplicate?.(envelope);
        this.emitHealthChange();
        return;
      }
      await this.markProcessed(envelope.id);
    }

    const listeners = [...(this.listenersByEvent.get(envelope.name) ?? [])]
      .sort((a, b) => b.priority - a.priority)
      .map((entry) => ({ ...entry }));

    if (listeners.length === 0) {
      return;
    }

    for (const listener of listeners) {
      try {
        await listener.handler(envelope.payload, envelope);
        this.metrics.dispatched += 1;
      } catch (error) {
        this.metrics.failed += 1;
        this.captureError(error);
        this.options.onListenerError?.(
          error,
          envelope,
          toSubscription(listener),
        );

        if (this.options.stopOnError) {
          this.emitHealthChange();
          throw error;
        }
      } finally {
        if (listener.once) {
          this.removeListenerById(envelope.name, listener.id);
        }
      }
    }

    this.emitHealthChange();
  }

  private addListener(
    event: string,
    handler: EventHandler,
    options: {
      source: ListenerSource;
      once: boolean;
      priority?: number;
    },
  ): EventUnsubscribe {
    const entry: ListenerRecord = {
      id: this.nextListenerId++,
      event,
      handler,
      source: options.source,
      once: options.once,
      priority: options.priority ?? 0,
    };

    const listeners = this.listenersByEvent.get(event) ?? [];
    listeners.push(entry);
    this.listenersByEvent.set(event, listeners);
    this.emitHealthChange();

    return () => {
      this.removeListenerById(event, entry.id);
      this.emitHealthChange();
    };
  }

  private removeListenerById(event: string, id: number): void {
    const listeners = this.listenersByEvent.get(event);
    if (!listeners || listeners.length === 0) {
      return;
    }

    const filtered = listeners.filter((entry) => entry.id !== id);
    this.setListeners(event, filtered);
  }

  private setListeners(
    event: string,
    listeners: readonly ListenerRecord[],
  ): void {
    if (listeners.length === 0) {
      this.listenersByEvent.delete(event);
      return;
    }

    this.listenersByEvent.set(event, [...listeners]);
  }

  private async isDuplicate(eventId: string): Promise<boolean> {
    const store = this.options.idempotency?.store;
    if (store) {
      return store.has(eventId);
    }

    this.gcDedup();
    return this.inMemoryDedup.has(eventId);
  }

  private async markProcessed(eventId: string): Promise<void> {
    const store = this.options.idempotency?.store;
    if (store) {
      await store.set(eventId, this.dedupTtlMs);
      return;
    }

    this.inMemoryDedup.set(eventId, Date.now() + this.dedupTtlMs);
    this.gcDedup();
  }

  private gcDedup(): void {
    const now = Date.now();

    for (const [eventId, expiresAt] of this.inMemoryDedup.entries()) {
      if (expiresAt <= now) {
        this.inMemoryDedup.delete(eventId);
      }
    }

    if (this.inMemoryDedup.size <= this.dedupMaxEntries) {
      return;
    }

    const entries = [...this.inMemoryDedup.entries()].sort(
      (a, b) => a[1] - b[1],
    );
    const toRemove = this.inMemoryDedup.size - this.dedupMaxEntries;

    for (let i = 0; i < toRemove; i += 1) {
      this.inMemoryDedup.delete(entries[i][0]);
    }
  }

  private captureError(error: unknown): void {
    this.lastError = toErrorMessage(error);
    this.lastErrorAt = new Date();
  }

  private emitHealthChange(): void {
    this.options.onHealthChange?.(this.getHealth());
  }
}

function toSubscription(listener: ListenerRecord): EventSubscription {
  return {
    event: listener.event,
    handler: listener.handler,
    priority: listener.priority,
    once: listener.once,
  };
}

async function withRetry<T>(
  operation: () => Promise<T> | T,
  policy?: RetryPolicy,
): Promise<T> {
  const maxAttempts = Math.max(1, policy?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, policy?.baseDelayMs ?? 100);
  const maxDelayMs = Math.max(baseDelayMs, policy?.maxDelayMs ?? 2_000);
  const multiplier = Math.max(1, policy?.multiplier ?? 2);
  const jitterMs = Math.max(0, policy?.jitterMs ?? 50);

  let attempt = 1;
  let delayMs = baseDelayMs;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
      await wait(delayMs + jitter);

      delayMs = Math.min(maxDelayMs, Math.floor(delayMs * multiplier));
      attempt += 1;
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
