import {
  BadRequestException,
  ConflictException,
  HttpController,
  HttpContext,
  HttpMiddleware,
  NotFoundException,
  UnauthorizedException,
  response,
} from "@trinacria/http";
import { type Schema, ValidationError } from "@trinacria/schema";
import {
  CreateUserDtoSchema,
  type CreateUserDto,
  UpdateUserDtoSchema,
  type UpdateUserDto,
} from "./dto";
import { UserService } from "./user.service";

export class UserController extends HttpController {
  constructor(private readonly users: UserService) {
    super();
  }

  routes() {
    const authMiddleware: HttpMiddleware = async (ctx, next) => {
      const authHeader = ctx.req.headers.authorization;

      if (authHeader !== "Bearer dev-token") {
        throw new UnauthorizedException("Missing or invalid token");
      }

      return next();
    };

    return this.router()
      .get("/users", this.listUsers)
      .get("/users/:id", this.getUserById)
      .post("/users", this.createUser, authMiddleware)
      .put("/users/:id", this.replaceUser, authMiddleware)
      .patch("/users/:id", this.updateUser, authMiddleware)
      .delete("/users/:id", this.deleteUser, authMiddleware)
      .build();
  }

  async listUsers() {
    return this.users.list();
  }

  async getUserById(ctx: HttpContext) {
    const user = this.users.findById(ctx.params.id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async createUser(ctx: HttpContext) {
    const payload = parseDto(CreateUserDtoSchema, ctx.body);

    if (this.users.existsByEmail(payload.email)) {
      throw new ConflictException("Email already in use");
    }

    const created = this.users.create(payload);

    return response(created, {
      status: 201,
      headers: {
        location: `/users/${created.id}`,
      },
    });
  }

  async replaceUser(ctx: HttpContext) {
    const payload = parseDto(CreateUserDtoSchema, ctx.body);
    const existing = this.users.findById(ctx.params.id);

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    if (this.users.existsByEmail(payload.email, existing.id)) {
      throw new ConflictException("Email already in use");
    }

    return this.users.update(existing.id, payload)!;
  }

  async updateUser(ctx: HttpContext) {
    const payload = parseDto(UpdateUserDtoSchema, ctx.body);
    const existing = this.users.findById(ctx.params.id);

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    if (payload.email && this.users.existsByEmail(payload.email, existing.id)) {
      throw new ConflictException("Email already in use");
    }

    return this.users.update(existing.id, payload)!;
  }

  async deleteUser(ctx: HttpContext) {
    const deleted = this.users.delete(ctx.params.id);

    if (!deleted) {
      throw new NotFoundException("User not found");
    }

    return response(undefined, { status: 204 });
  }
}

function parseDto<T>(schema: Schema<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      const firstIssue = error.issues[0];
      const path = firstIssue.path.map(String).join(".");
      const message = path
        ? `Invalid "${path}": ${firstIssue.message}`
        : firstIssue.message;
      throw new BadRequestException(message);
    }

    throw error;
  }
}
