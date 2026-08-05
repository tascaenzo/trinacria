import type { MaybePromise } from "@trinacria/core";
import type { EventEnvelope, EventTransport, RetryPolicy } from "../contracts";

export interface RabbitMqMessage {
  readonly content: Buffer;
}

export interface RabbitMqConsumeOk {
  readonly consumerTag: string;
}

export interface RabbitMqChannelLike {
  assertExchange(
    exchange: string,
    type: "topic",
    options?: { durable?: boolean },
  ): MaybePromise<void>;
  assertQueue(
    queue: string,
    options?: { exclusive?: boolean; durable?: boolean; autoDelete?: boolean },
  ): MaybePromise<{ queue: string }>;
  bindQueue(
    queue: string,
    exchange: string,
    pattern: string,
  ): MaybePromise<void>;
  unbindQueue?(
    queue: string,
    exchange: string,
    pattern: string,
  ): MaybePromise<void>;
  consume(
    queue: string,
    onMessage: (message: RabbitMqMessage | null) => MaybePromise<void>,
    options?: { noAck?: boolean },
  ): MaybePromise<RabbitMqConsumeOk>;
  cancel?(consumerTag: string): MaybePromise<void>;
  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: { persistent?: boolean },
  ): boolean;
  waitForConfirms?(): MaybePromise<void>;
  ack?(message: RabbitMqMessage): void;
  nack?(message: RabbitMqMessage, allUpTo?: boolean, requeue?: boolean): void;
  deleteQueue?(queue: string): MaybePromise<void>;
}

export interface RabbitMqEventTransportOptions {
  readonly channel: RabbitMqChannelLike;
  readonly exchange?: string;
  readonly queueName?: string;
  /**
   * Routing key filter used to bind queue. Default listens to all events.
   */
  readonly routingPattern?: string;
  readonly retry?: {
    readonly connect?: RetryPolicy;
    readonly publish?: RetryPolicy;
  };
  readonly usePublisherConfirms?: boolean;
  readonly deadLetter?: {
    readonly exchange?: string;
    readonly routingPrefix?: string;
  };
  readonly onConsumeError?: (error: unknown, raw: string) => void;
  readonly maxMessageBytes?: number;
}

export class RabbitMqEventTransport implements EventTransport {
  private readonly exchange: string;
  private readonly queueName?: string;
  private readonly routingPattern: string;
  private boundQueueName?: string;
  private consumerTag?: string;
  private readonly dlxExchange?: string;
  private readonly dlxRoutingPrefix: string;

  constructor(private readonly options: RabbitMqEventTransportOptions) {
    this.exchange = options.exchange ?? "trinacria.events";
    this.queueName = options.queueName;
    this.routingPattern = options.routingPattern ?? "#";
    this.dlxExchange = options.deadLetter?.exchange;
    this.dlxRoutingPrefix = options.deadLetter?.routingPrefix ?? "dlq";
    assertPositiveMessageLimit(options.maxMessageBytes);
  }

  async connect(
    onEnvelope: (envelope: EventEnvelope) => MaybePromise<void>,
  ): Promise<void> {
    await withRetry(async () => {
      await this.options.channel.assertExchange(this.exchange, "topic", {
        durable: true,
      });

      if (this.dlxExchange) {
        await this.options.channel.assertExchange(this.dlxExchange, "topic", {
          durable: true,
        });
      }

      const isNamedQueue = this.queueName !== undefined;
      const assertedQueue = await this.options.channel.assertQueue(
        this.queueName ?? `trinacria.events.${crypto.randomUUID()}`,
        {
          exclusive: !isNamedQueue,
          durable: isNamedQueue,
          autoDelete: !isNamedQueue,
        },
      );

      this.boundQueueName = assertedQueue.queue;

      await this.options.channel.bindQueue(
        this.boundQueueName,
        this.exchange,
        this.routingPattern,
      );

      const consumeOk = await this.options.channel.consume(
        this.boundQueueName,
        async (message) => {
          if (!message) {
            return;
          }

          const raw = message.content.toString("utf8");

          try {
            assertMessageSize(message.content, this.options.maxMessageBytes);
            const envelope = parseEnvelope(raw);
            await onEnvelope(envelope);
            this.options.channel.ack?.(message);
          } catch (error) {
            this.options.onConsumeError?.(error, raw);

            if (this.dlxExchange) {
              const parsed = tryParseEnvelope(raw);
              const routingKey = `${this.dlxRoutingPrefix}.${toRoutingKey(parsed?.name ?? "unknown")}`;
              this.options.channel.publish(
                this.dlxExchange,
                routingKey,
                Buffer.from(raw, "utf8"),
                { persistent: true },
              );
              this.options.channel.ack?.(message);
              return;
            }

            this.options.channel.nack?.(message, false, false);
          }
        },
        { noAck: false },
      );

      this.consumerTag = consumeOk.consumerTag;
    }, this.options.retry?.connect);
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    const routingKey = toRoutingKey(envelope.name);
    const content = Buffer.from(JSON.stringify(envelope), "utf8");
    assertMessageSize(content, this.options.maxMessageBytes);

    await withRetry(async () => {
      const published = this.options.channel.publish(
        this.exchange,
        routingKey,
        content,
        { persistent: true },
      );

      if (!published) {
        throw new Error(
          `RabbitMQ channel backpressure while publishing event "${envelope.name}".`,
        );
      }

      if (this.options.usePublisherConfirms) {
        if (!this.options.channel.waitForConfirms) {
          throw new Error(
            "RabbitMQ publisher confirms enabled but waitForConfirms is not available.",
          );
        }

        await this.options.channel.waitForConfirms();
      }
    }, this.options.retry?.publish);
  }

  async disconnect(): Promise<void> {
    if (this.consumerTag) {
      await this.options.channel.cancel?.(this.consumerTag);
      this.consumerTag = undefined;
    }

    if (!this.boundQueueName) {
      return;
    }

    await this.options.channel.unbindQueue?.(
      this.boundQueueName,
      this.exchange,
      this.routingPattern,
    );

    if (!this.queueName) {
      await this.options.channel.deleteQueue?.(this.boundQueueName);
    }

    this.boundQueueName = undefined;
  }
}

function parseEnvelope(raw: string): EventEnvelope {
  const parsed = JSON.parse(raw) as EventEnvelope;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid event envelope payload: expected object.");
  }

  if (
    typeof parsed.id !== "string" ||
    parsed.id.length === 0 ||
    parsed.id.length > 128
  ) {
    throw new Error("Invalid event envelope payload: missing id.");
  }

  if (
    typeof parsed.name !== "string" ||
    parsed.name.length === 0 ||
    parsed.name.length > 256
  ) {
    throw new Error("Invalid event envelope payload: missing name.");
  }

  if (
    typeof parsed.publishedAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.publishedAt))
  ) {
    throw new Error("Invalid event envelope payload: missing publishedAt.");
  }

  return {
    ...parsed,
    publishedAt: new Date(parsed.publishedAt),
  };
}

const DEFAULT_MAX_MESSAGE_BYTES = 1_048_576;

function assertMessageSize(content: Buffer, configuredLimit?: number): void {
  const limit = configuredLimit ?? DEFAULT_MAX_MESSAGE_BYTES;
  if (content.byteLength > limit) {
    throw new Error(`Event message exceeds ${limit} bytes.`);
  }
}

function assertPositiveMessageLimit(value: number | undefined): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
    throw new RangeError("RabbitMqEventTransport.maxMessageBytes must be >= 1");
  }
}

function tryParseEnvelope(raw: string): EventEnvelope | null {
  try {
    return parseEnvelope(raw);
  } catch {
    return null;
  }
}

function toRoutingKey(eventName: string): string {
  return eventName.replace(/[^a-zA-Z0-9_.-]/g, ".");
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
