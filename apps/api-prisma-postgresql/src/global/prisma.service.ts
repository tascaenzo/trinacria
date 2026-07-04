import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createToken } from "@trinacria/core";
import type { ConfigService } from "./config.service";

export const PRISMA_SERVICE = createToken<PrismaService>("PRISMA_SERVICE");

export class PrismaService extends PrismaClient {
  constructor(private readonly configService: ConfigService) {
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
