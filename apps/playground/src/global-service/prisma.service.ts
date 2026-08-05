import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createToken } from "@trinacria/core";
import { PrismaClient } from "../generated/prisma/client";
import type { ConfigService } from "./config.service";

export const PRISMA_SERVICE = createToken<PrismaService>("PRISMA_SERVICE");

export class PrismaService extends PrismaClient {
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaBetterSqlite3({
        url: configService.get("DATABASE_URL"),
      }),
    });
  }

  async onDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
