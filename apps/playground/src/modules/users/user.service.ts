import * as argon2 from "argon2";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../global-service/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type PublicUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PublicUserRecord[]> {
    return this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async findById(id: string): Promise<PublicUserRecord | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    return user ?? undefined;
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        ...(excludeId
          ? {
              id: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: { id: true },
    });

    return Boolean(existing);
  }

  async create(input: CreateUserDto): Promise<PublicUserRecord> {
    /**
     * Playground user creation is admin-like and does not receive a plaintext
     * password input, so we initialize with a random hash.
     */
    const passwordHash = await argon2.hash(crypto.randomUUID());

    return this.prisma.user.create({
      select: publicUserSelect,
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        role: "user",
        passwordHash,
      },
    });
  }

  async update(
    id: string,
    input: UpdateUserDto,
  ): Promise<PublicUserRecord | undefined> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return undefined;
    }

    return this.prisma.user.update({
      select: publicUserSelect,
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined
          ? { email: input.email.toLowerCase() }
          : {}),
      },
    });
  }

  async delete(id: string): Promise<PublicUserRecord | undefined> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!existing) {
      return undefined;
    }

    await this.prisma.user.delete({ where: { id } });
    return existing;
  }
}
