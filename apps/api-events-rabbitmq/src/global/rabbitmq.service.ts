import { createToken } from "@trinacria/core";
import type { RabbitMqChannelLike } from "@trinacria/events";
import { connect, type Channel, type ChannelModel } from "amqplib";
import type { ConfigService } from "./config.service";

export const RABBITMQ_SERVICE =
  createToken<RabbitMqService>("RABBITMQ_SERVICE");

export class RabbitMqService {
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(private readonly config: ConfigService) {}

  async onInit(): Promise<void> {
    if (!this.connection) {
      this.connection = await connect(this.config.get("RABBITMQ_URL"));
    }

    if (!this.channel) {
      this.channel = await this.connection.createChannel();
    }
  }

  getChannel(): Channel {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not initialized.");
    }

    return this.channel;
  }

  getTransportChannel(): RabbitMqChannelLike {
    const channel = this.getChannel();

    return {
      assertExchange: async (exchange, type, options) => {
        await channel.assertExchange(exchange, type, options);
      },
      assertQueue: (queue, options) => channel.assertQueue(queue, options),
      bindQueue: async (queue, exchange, pattern) => {
        await channel.bindQueue(queue, exchange, pattern);
      },
      unbindQueue: async (queue, exchange, pattern) => {
        await channel.unbindQueue(queue, exchange, pattern);
      },
      consume: async (queue, onMessage, options) => {
        const consumeOk = await channel.consume(
          queue,
          async (message) => {
            await onMessage(message);
          },
          options,
        );

        return { consumerTag: consumeOk.consumerTag };
      },
      cancel: async (consumerTag) => {
        await channel.cancel(consumerTag);
      },
      publish: (exchange, routingKey, content, options) =>
        channel.publish(exchange, routingKey, content, options),
      ack: (message) => {
        channel.ack(message as any);
      },
      nack: (message, allUpTo, requeue) => {
        channel.nack(message as any, allUpTo, requeue);
      },
      deleteQueue: async (queue) => {
        await channel.deleteQueue(queue);
      },
    };
  }

  async onDestroy(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = undefined;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
  }
}
