import type { MaybePromise } from "@trinacria/core";

export interface EventEnvelope<TPayload = unknown> {
  readonly id: string;
  readonly name: string;
  readonly payload: TPayload;
  readonly publishedAt: Date;
  readonly source?: string;
  readonly version?: number;
  readonly headers?: Record<string, string>;
}

export type EventHandler<TPayload = unknown> = (
  payload: TPayload,
  envelope: EventEnvelope<TPayload>,
) => MaybePromise<void>;

export interface EventSubscription<TPayload = unknown> {
  readonly event: string;
  readonly handler: EventHandler<TPayload>;
  /**
   * Higher values run first.
   */
  readonly priority?: number;
  readonly once?: boolean;
}

export interface EventProvider {
  subscriptions(): EventSubscription | readonly EventSubscription[];
}

export interface EventListenerOptions {
  readonly priority?: number;
  readonly once?: boolean;
}

export type EventUnsubscribe = () => void;

export interface EventBus {
  emit<TPayload>(event: string, payload: TPayload): Promise<void>;
  on<TPayload>(
    event: string,
    handler: EventHandler<TPayload>,
    options?: EventListenerOptions,
  ): EventUnsubscribe;
  once<TPayload>(
    event: string,
    handler: EventHandler<TPayload>,
    options?: Omit<EventListenerOptions, "once">,
  ): EventUnsubscribe;
  off<TPayload>(event: string, handler: EventHandler<TPayload>): void;
  listenerCount(event?: string): number;
  getHealth?(): EventBusHealth;
}

export interface ManagedEventBus extends EventBus {
  replaceManagedSubscriptions(subscriptions: readonly EventSubscription[]): void;
  clear(): void;
  start?(): MaybePromise<void>;
  stop?(): MaybePromise<void>;
}

export interface RetryPolicy {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly multiplier?: number;
  readonly jitterMs?: number;
}

export interface EventIdempotencyStore {
  has(eventId: string): MaybePromise<boolean>;
  set(eventId: string, ttlMs: number): MaybePromise<void>;
}

export interface EventValidationContext {
  readonly direction: "inbound" | "outbound";
}

export interface EventBusMetricsSnapshot {
  readonly emitted: number;
  readonly dispatched: number;
  readonly failed: number;
  readonly deduplicated: number;
}

export interface EventBusHealth {
  readonly connected: boolean;
  readonly listeners: number;
  readonly metrics: EventBusMetricsSnapshot;
  readonly lastError?: string;
  readonly lastErrorAt?: Date;
}

export interface EventTransport {
  connect(
    onEnvelope: (envelope: EventEnvelope) => MaybePromise<void>,
  ): MaybePromise<void>;
  publish(envelope: EventEnvelope): MaybePromise<void>;
  disconnect?(): MaybePromise<void>;
}

export interface EventPluginOptions {
  /**
   * Optional external transport (Redis Pub/Sub, RabbitMQ, NATS, ...).
   */
  readonly transport?: EventTransport;
  /**
   * Optional custom bus implementation.
   */
  readonly bus?: ManagedEventBus;
  /**
   * If true (default), emit dispatches local listeners even when a transport is configured.
   * Set to false when your transport already loops events back to the same node.
   */
  readonly dispatchLocalOnEmit?: boolean;
  /**
   * Optional identifier used in event metadata.
   */
  readonly source?: string;
  /**
   * Envelope version injected into emitted events.
   */
  readonly version?: number;
  /**
   * Static metadata headers merged in outgoing envelope.
   */
  readonly headers?: Record<string, string>;
  /**
   * Validation hook called for both outbound and inbound envelopes.
   * Throw to reject the envelope.
   */
  readonly validateEnvelope?: (
    envelope: EventEnvelope,
    context: EventValidationContext,
  ) => MaybePromise<void>;
  /**
   * Deduplication options used to prevent duplicate consumption in at-least-once brokers.
   */
  readonly idempotency?: {
    readonly ttlMs?: number;
    readonly maxEntries?: number;
    readonly store?: EventIdempotencyStore;
  };
  /**
   * Retry policy for transport connect and publish operations.
   */
  readonly retry?: {
    readonly connect?: RetryPolicy;
    readonly publish?: RetryPolicy;
  };
  readonly stopOnError?: boolean;
  readonly onListenerError?: (
    error: unknown,
    envelope: EventEnvelope,
    subscription: EventSubscription,
  ) => void;
  readonly onDispatchSkippedDuplicate?: (envelope: EventEnvelope) => void;
  readonly onHealthChange?: (health: EventBusHealth) => void;
}
