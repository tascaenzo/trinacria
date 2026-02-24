import mongoose, { type Connection } from "mongoose";
import { createToken } from "@trinacria/core";
import type { ConfigService } from "./config.service";

export const MONGOOSE_SERVICE =
  createToken<MongooseService>("MONGOOSE_SERVICE");

export class MongooseService {
  private connection?: Connection;

  constructor(private readonly config: ConfigService) {}

  async onInit(): Promise<void> {
    if (this.connection?.readyState === 1) {
      return;
    }

    await mongoose.connect(this.config.get("DATABASE_URL"));
    this.connection = mongoose.connection;
  }

  getConnection(): Connection {
    if (!this.connection || this.connection.readyState !== 1) {
      throw new Error("Mongoose connection is not ready");
    }

    return this.connection;
  }

  async onDestroy(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = undefined;
    }
  }
}
