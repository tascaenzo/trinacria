import type { Prisma } from "../../generated/prisma/client";
import type { PrismaService } from "../../global/prisma.service";
import type { CreateUserDto } from "./dto";

const userSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type UserRecord = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<UserRecord[]> {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(input: CreateUserDto): Promise<UserRecord> {
    return this.prisma.user.create({
      select: userSelect,
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
      },
    });
  }
}
