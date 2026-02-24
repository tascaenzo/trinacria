import type { CreateUserDto, PublicUserDto } from "./dto";
import type { UserDocument, UserSchemaModel } from "./users.schema";

export class UsersService {
  constructor(private readonly userSchema: UserSchemaModel) {}

  async list(): Promise<PublicUserDto[]> {
    const users: UserDocument[] = await this.userSchema
      .find({}, undefined, { sort: { createdAt: -1 } })
      .exec();

    return users.map((user: UserDocument) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  async create(input: CreateUserDto): Promise<PublicUserDto> {
    const created = await this.userSchema.create({
      name: input.name,
      email: input.email.toLowerCase(),
    });

    return {
      id: String(created._id),
      name: created.name,
      email: created.email,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }
}
