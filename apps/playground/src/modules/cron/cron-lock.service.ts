import type { PrismaService } from "../../global-service/prisma.service";

export interface AcquiredCronLock {
  readonly lockToken: string;
}

/**
 * DB-backed lock service for playground cron jobs.
 * Uses SQLite upsert semantics to acquire a lock only when missing/expired.
 */
export class CronLockService {
  constructor(private readonly prisma: PrismaService) {}

  async acquire(
    jobName: string,
    ttlMs: number,
  ): Promise<AcquiredCronLock | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    const lockToken = crypto.randomUUID();

    const affectedRows = await this.prisma.$executeRaw`
      INSERT INTO "CronLock" ("jobName", "lockToken", "expiresAt", "updatedAt")
      VALUES (${jobName}, ${lockToken}, ${expiresAt}, ${now})
      ON CONFLICT("jobName") DO UPDATE SET
        "lockToken" = excluded."lockToken",
        "expiresAt" = excluded."expiresAt",
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "CronLock"."expiresAt" <= ${now}
    `;

    return Number(affectedRows) > 0 ? { lockToken } : null;
  }

  async release(jobName: string, lockToken: string): Promise<void> {
    await this.prisma.cronLock.deleteMany({
      where: {
        jobName,
        lockToken,
      },
    });
  }

  async renew(
    jobName: string,
    lockToken: string,
    ttlMs: number,
  ): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const result = await this.prisma.cronLock.updateMany({
      where: {
        jobName,
        lockToken,
      },
      data: {
        expiresAt,
      },
    });

    return result.count > 0;
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.cronLock.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });

    return result.count;
  }
}
