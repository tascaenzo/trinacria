import { PrismaPg } from "@prisma/adapter-pg";
import { createToken } from "@trinacria/core";
import { PrismaClient } from "../generated/prisma/client";
import type { ConfigService } from "./config.service";

export const PRISMA_SERVICE = createToken<PrismaService>("PRISMA_SERVICE");

export class PrismaService extends PrismaClient {
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.get("DATABASE_URL"),
      }),
    });
  }

  async onDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
