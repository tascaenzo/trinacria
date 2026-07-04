import { createClient, type RedisClientType } from "redis";
import { createToken } from "@trinacria/core";
import type { ConfigService } from "./config.service";

export const REDIS_SERVICE = createToken<RedisService>("REDIS_SERVICE");

export class RedisService {
  private readonly publisherClient: RedisClientType;
  private readonly subscriberClient: RedisClientType;

  constructor(config: ConfigService) {
    const redisUrl = config.get("REDIS_URL");

    this.publisherClient = createClient({
      url: redisUrl,
    });

    this.subscriberClient = createClient({
      url: redisUrl,
    });
  }

  async onInit(): Promise<void> {
    if (!this.publisherClient.isOpen) {
      await this.publisherClient.connect();
    }

    if (!this.subscriberClient.isOpen) {
      await this.subscriberClient.connect();
    }
  }

  getPublisherClient(): RedisClientType {
    return this.publisherClient;
  }

  getSubscriberClient(): RedisClientType {
    return this.subscriberClient;
  }

  async onDestroy(): Promise<void> {
    if (this.publisherClient.isOpen) {
      await this.publisherClient.quit();
    }

    if (this.subscriberClient.isOpen) {
      await this.subscriberClient.quit();
    }
  }
}
