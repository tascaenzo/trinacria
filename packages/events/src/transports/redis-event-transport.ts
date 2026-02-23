import type { MaybePromise } from "@trinacria/core";
import type { EventEnvelope, EventTransport, RetryPolicy } from "../contracts";

export interface RedisPublisherClient {
  publish(channel: string, message: string): MaybePromise<number>;
}

export interface RedisSubscriberClient {
  subscribe(
    channel: string,
    onMessage: (message: string, channel: string) => MaybePromise<void>,
  ): MaybePromise<void>;
  unsubscribe(
    channel: string,
    onMessage?: (message: string, channel: string) => MaybePromise<void>,
  ): MaybePromise<void>;
}

export interface RedisEventTransportOptions {
  readonly publisher: RedisPublisherClient;
  readonly subscriber: RedisSubscriberClient;
  /**
   * Shared pub/sub channel carrying all Trinacria event envelopes.
   */
  readonly channel?: string;
  readonly retry?: {
    readonly connect?: RetryPolicy;
    readonly publish?: RetryPolicy;
  };
  readonly onMessageError?: (error: unknown, raw: string) => void;
}

export class RedisEventTransport implements EventTransport {
  private readonly channel: string;
  private onMessageRef?: (message: string, channel: string) => Promise<void>;

  constructor(private readonly options: RedisEventTransportOptions) {
    this.channel = options.channel ?? "trinacria:events";
  }

  async connect(
    onEnvelope: (envelope: EventEnvelope) => MaybePromise<void>,
  ): Promise<void> {
    this.onMessageRef = async (message: string) => {
      try {
        const envelope = parseEnvelope(message);
        await onEnvelope(envelope);
      } catch (error) {
        this.options.onMessageError?.(error, message);
        throw error;
      }
    };

    await withRetry(
      () => this.options.subscriber.subscribe(this.channel, this.onMessageRef!),
      this.options.retry?.connect,
    );
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    await withRetry(
      () =>
        this.options.publisher.publish(this.channel, JSON.stringify(envelope)),
      this.options.retry?.publish,
    );
  }

  async disconnect(): Promise<void> {
    if (!this.onMessageRef) {
      return;
    }

    await this.options.subscriber.unsubscribe(this.channel, this.onMessageRef);
    this.onMessageRef = undefined;
  }
}

function parseEnvelope(raw: string): EventEnvelope {
  const parsed = JSON.parse(raw) as EventEnvelope;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid event envelope payload: expected object.");
  }

  if (typeof parsed.id !== "string" || parsed.id.length === 0) {
    throw new Error("Invalid event envelope payload: missing id.");
  }

  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    throw new Error("Invalid event envelope payload: missing name.");
  }

  if (typeof parsed.publishedAt !== "string") {
    throw new Error("Invalid event envelope payload: missing publishedAt.");
  }

  return {
    ...parsed,
    publishedAt: new Date(parsed.publishedAt),
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
