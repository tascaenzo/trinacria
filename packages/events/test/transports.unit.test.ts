import assert from "node:assert/strict";
import test from "node:test";
import {
  type EventEnvelope,
  RabbitMqEventTransport,
  type RabbitMqMessage,
  RedisEventTransport,
} from "../src";

test("RedisEventTransport publish + subscribe loopback", async () => {
  const callbacks = new Map<
    string,
    (message: string, channel: string) => Promise<void> | void
  >();
  const published: string[] = [];

  const transport = new RedisEventTransport({
    publisher: {
      async publish(channel, message) {
        published.push(channel);
        const callback = callbacks.get(channel);
        if (callback) {
          await callback(message, channel);
        }
        return 1;
      },
    },
    subscriber: {
      async subscribe(channel, onMessage) {
        callbacks.set(channel, onMessage);
      },
      async unsubscribe(channel) {
        callbacks.delete(channel);
      },
    },
  });

  const received: EventEnvelope[] = [];
  await transport.connect(async (envelope) => {
    received.push(envelope);
  });

  const event: EventEnvelope = {
    id: "evt-1",
    name: "order.created",
    payload: { id: 42 },
    publishedAt: new Date("2026-02-23T10:00:00.000Z"),
    source: "orders-service",
  };

  await transport.publish(event);

  assert.deepEqual(published, ["trinacria:events"]);
  assert.equal(received.length, 1);
  assert.equal(received[0].name, "order.created");
  assert.equal(received[0].source, "orders-service");
  assert.ok(received[0].publishedAt instanceof Date);

  await transport.disconnect();
  assert.equal(callbacks.size, 0);
});

test("RedisEventTransport retries connect and forwards parsing errors", async () => {
  let subscribeAttempts = 0;
  const callbacks = new Map<
    string,
    (message: string, channel: string) => Promise<void> | void
  >();
  const errors: string[] = [];

  const transport = new RedisEventTransport({
    publisher: {
      async publish() {
        return 1;
      },
    },
    subscriber: {
      async subscribe(channel, onMessage) {
        subscribeAttempts += 1;
        if (subscribeAttempts < 3) {
          throw new Error("connect fail");
        }
        callbacks.set(channel, onMessage);
      },
      async unsubscribe(channel) {
        callbacks.delete(channel);
      },
    },
    retry: {
      connect: {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 2,
        multiplier: 1,
        jitterMs: 0,
      },
    },
    onMessageError: (error) => {
      errors.push(String((error as Error).message));
    },
  });

  await transport.connect(async () => {});
  assert.equal(subscribeAttempts, 3);

  const callback = callbacks.get("trinacria:events");
  await assert.rejects(
    async () => callback!("{bad-json", "trinacria:events"),
    /SyntaxError|Invalid event envelope payload/,
  );
  assert.equal(errors.length, 1);
});

test("RabbitMqEventTransport publish + consume", async () => {
  let boundQueue = "";
  let consumerHandler:
    | ((message: RabbitMqMessage | null) => Promise<void> | void)
    | undefined;
  const consumerTag = "consumer-1";
  const publishedRoutingKeys: string[] = [];
  let acked = 0;
  let cancelled = 0;
  let confirms = 0;

  const transport = new RabbitMqEventTransport({
    channel: {
      async assertExchange() {},
      async assertQueue(queueName) {
        return { queue: queueName || "generated.queue" };
      },
      async bindQueue(queue) {
        boundQueue = queue;
      },
      async consume(_queue, handler) {
        consumerHandler = handler;
        return { consumerTag };
      },
      publish(_exchange, routingKey, _content) {
        publishedRoutingKeys.push(routingKey);
        return true;
      },
      async waitForConfirms() {
        confirms += 1;
      },
      ack() {
        acked += 1;
      },
      async cancel() {
        cancelled += 1;
      },
      async unbindQueue() {},
      async deleteQueue() {},
    },
    exchange: "app.events",
    queueName: "users.read-model",
    routingPattern: "#",
    usePublisherConfirms: true,
  });

  const received: EventEnvelope[] = [];
  await transport.connect(async (envelope) => {
    received.push(envelope);
  });

  assert.equal(boundQueue, "users.read-model");

  const outgoing: EventEnvelope = {
    id: "evt-2",
    name: "user.created",
    payload: { id: 7 },
    publishedAt: new Date("2026-02-23T11:00:00.000Z"),
    source: "users-service",
  };

  await transport.publish(outgoing);
  assert.deepEqual(publishedRoutingKeys, ["user.created"]);

  const incoming = Buffer.from(
    JSON.stringify({
      id: "evt-3",
      name: "user.deleted",
      payload: { id: 7 },
      publishedAt: "2026-02-23T11:01:00.000Z",
      source: "users-service",
    }),
    "utf8",
  );

  await consumerHandler?.({ content: incoming });

  assert.equal(received.length, 1);
  assert.equal(received[0].name, "user.deleted");
  assert.equal(received[0].source, "users-service");
  assert.ok(received[0].publishedAt instanceof Date);
  assert.equal(acked, 1);

  await transport.disconnect();
  assert.equal(cancelled, 1);
  assert.equal(confirms, 1);
});

test("RabbitMqEventTransport sends malformed payloads to dead-letter exchange", async () => {
  let consumerHandler:
    | ((message: RabbitMqMessage | null) => Promise<void> | void)
    | undefined;
  const published: Array<{
    exchange: string;
    routingKey: string;
    content: string;
  }> = [];
  let acked = 0;

  const transport = new RabbitMqEventTransport({
    channel: {
      async assertExchange() {},
      async assertQueue(queueName) {
        return { queue: queueName || "q" };
      },
      async bindQueue() {},
      async consume(_queue, handler) {
        consumerHandler = handler;
        return { consumerTag: "consumer-dlq" };
      },
      publish(exchange, routingKey, content) {
        published.push({
          exchange,
          routingKey,
          content: content.toString("utf8"),
        });
        return true;
      },
      ack() {
        acked += 1;
      },
      async cancel() {},
      async unbindQueue() {},
    },
    exchange: "app.events",
    queueName: "users.read-model",
    deadLetter: {
      exchange: "app.events.dlq",
      routingPrefix: "dead",
    },
  });

  await transport.connect(async () => {
    throw new Error("should not be called");
  });

  await consumerHandler?.({ content: Buffer.from("{broken-json", "utf8") });

  assert.equal(acked, 1);
  assert.equal(published.length, 1);
  assert.equal(published[0].exchange, "app.events.dlq");
  assert.equal(published[0].routingKey, "dead.unknown");
});

test("RabbitMqEventTransport nacks malformed payload without dead-letter", async () => {
  let consumerHandler:
    | ((message: RabbitMqMessage | null) => Promise<void> | void)
    | undefined;
  let nacked = 0;
  const consumeErrors: string[] = [];

  const transport = new RabbitMqEventTransport({
    channel: {
      async assertExchange() {},
      async assertQueue(queueName) {
        return { queue: queueName || "q" };
      },
      async bindQueue() {},
      async consume(_queue, handler) {
        consumerHandler = handler;
        return { consumerTag: "consumer-nack" };
      },
      publish() {
        return true;
      },
      nack() {
        nacked += 1;
      },
      async cancel() {},
      async unbindQueue() {},
    },
    exchange: "app.events",
    queueName: "users.read-model",
    onConsumeError: (error) => {
      consumeErrors.push(String((error as Error).message));
    },
  });

  await transport.connect(async () => {});
  await consumerHandler?.({ content: Buffer.from("{broken-json", "utf8") });

  assert.equal(nacked, 1);
  assert.equal(consumeErrors.length, 1);
});

test("RabbitMqEventTransport throws when confirms are enabled but channel lacks support", async () => {
  const transport = new RabbitMqEventTransport({
    channel: {
      async assertExchange() {},
      async assertQueue(queueName) {
        return { queue: queueName || "generated.queue" };
      },
      async bindQueue() {},
      async consume() {
        return { consumerTag: "consumer-confirm-missing" };
      },
      publish() {
        return true;
      },
    },
    queueName: "users.read-model",
    usePublisherConfirms: true,
    retry: {
      publish: {
        maxAttempts: 1,
        baseDelayMs: 1,
        maxDelayMs: 2,
        multiplier: 1,
        jitterMs: 0,
      },
    },
  });

  await transport.connect(async () => {});

  await assert.rejects(
    () =>
      transport.publish({
        id: "evt-confirm",
        name: "user.confirm",
        payload: { id: 1 },
        publishedAt: new Date(),
      }),
    /waitForConfirms is not available/,
  );
});

test("event transports reject invalid limits and oversized outbound messages", async () => {
  const redisOptions = {
    publisher: { publish: async () => 1 },
    subscriber: {
      subscribe: async () => {},
      unsubscribe: async () => {},
    },
  };

  assert.throws(
    () => new RedisEventTransport({ ...redisOptions, maxMessageBytes: 0 }),
    /must be >= 1/,
  );

  const redis = new RedisEventTransport({
    ...redisOptions,
    maxMessageBytes: 64,
  });
  await assert.rejects(
    () =>
      redis.publish({
        id: "evt-large",
        name: "large.event",
        payload: "x".repeat(100),
        publishedAt: new Date(),
      }),
    /exceeds 64 bytes/,
  );

  const rabbitOptions = {
    channel: {
      async assertExchange() {},
      async assertQueue() {
        return { queue: "q" };
      },
      async bindQueue() {},
      async consume() {
        return { consumerTag: "consumer" };
      },
      publish() {
        return true;
      },
    },
  };
  assert.throws(
    () => new RabbitMqEventTransport({ ...rabbitOptions, maxMessageBytes: -1 }),
    /must be >= 1/,
  );

  const rabbit = new RabbitMqEventTransport({
    ...rabbitOptions,
    maxMessageBytes: 64,
  });
  await assert.rejects(
    () =>
      rabbit.publish({
        id: "evt-large",
        name: "large.event",
        payload: "x".repeat(100),
        publishedAt: new Date(),
      }),
    /exceeds 64 bytes/,
  );
});
