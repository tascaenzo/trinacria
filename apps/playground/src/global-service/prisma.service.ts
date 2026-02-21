import { PrismaClient } from "@prisma/client";
import { createToken } from "@trinacria/core";

export const PRISMA_SERVICE = createToken<PrismaService>("PRISMA_SERVICE");

export class PrismaService extends PrismaClient {
  async onDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
