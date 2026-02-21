import {
  BadRequestException,
  ConflictException,
  HttpController,
  HttpContext,
  NotFoundException,
  response,
} from "@trinacria/http";
import { toOpenApi, type Schema, ValidationError } from "@trinacria/schema";
import { AuthGuardFactory } from "../auth/auth-guard.factory";
import { CreateUserDtoSchema, UpdateUserDtoSchema } from "./dto";
import { UserService } from "./user.service";

export class UserController extends HttpController {
  constructor(
    private readonly users: UserService,
    private readonly authGuardFactory: AuthGuardFactory,
  ) {
    super();
  }

  routes() {
    const authMiddleware = this.authGuardFactory.requireAuth();
    const csrfMiddleware = this.authGuardFactory.requireCsrf();

    return this.router()
      .get("/users", this.listUsers, {
        docs: {
          tags: ["Users"],
          summary: "List users",
          responses: {
            200: {
              description: "Users list",
              schema: {
                type: "array",
                items: userSchema(),
              },
            },
          },
        },
      })
      .get("/users/:id", this.getUserById, {
        docs: {
          tags: ["Users"],
          summary: "Get user by id",
          responses: {
            200: {
              description: "User",
              schema: userSchema(),
            },
            404: {
              description: "User not found",
            },
          },
        },
      })
      .post("/users", this.createUser, {
        middlewares: [authMiddleware, csrfMiddleware],
        docs: {
          tags: ["Users"],
          summary: "Create user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [] },
            { csrfHeader: [] },
          ],
          requestBody: {
            required: true,
            schema: toOpenApi(CreateUserDtoSchema),
          },
          responses: {
            201: {
              description: "Created user",
              schema: userSchema(),
            },
          },
        },
      })
      .put("/users/:id", this.replaceUser, {
        middlewares: [authMiddleware, csrfMiddleware],
        docs: {
          tags: ["Users"],
          summary: "Replace user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [] },
            { csrfHeader: [] },
          ],
          requestBody: {
            required: true,
            schema: toOpenApi(CreateUserDtoSchema),
          },
          responses: {
            200: {
              description: "Updated user",
              schema: userSchema(),
            },
          },
        },
      })
      .patch("/users/:id", this.updateUser, {
        middlewares: [authMiddleware, csrfMiddleware],
        docs: {
          tags: ["Users"],
          summary: "Patch user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [] },
            { csrfHeader: [] },
          ],
          requestBody: {
            required: true,
            schema: toOpenApi(UpdateUserDtoSchema),
          },
          responses: {
            200: {
              description: "Updated user",
              schema: userSchema(),
            },
          },
        },
      })
      .delete("/users/:id", this.deleteUser, {
        middlewares: [authMiddleware, csrfMiddleware],
        docs: {
          tags: ["Users"],
          summary: "Delete user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [] },
            { csrfHeader: [] },
          ],
          responses: {
            204: {
              description: "Deleted",
            },
          },
        },
      })
      .build();
  }

  async listUsers() {
    return this.users.list();
  }

  async getUserById(ctx: HttpContext) {
    const user = await this.users.findById(ctx.params.id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async createUser(ctx: HttpContext) {
    const payload = parseDto(CreateUserDtoSchema, ctx.body);

    if (await this.users.existsByEmail(payload.email)) {
      throw new ConflictException("Email already in use");
    }

    const created = await this.users.create(payload);

    return response(created, {
      status: 201,
      headers: {
        location: `/users/${created.id}`,
      },
    });
  }

  async replaceUser(ctx: HttpContext) {
    const payload = parseDto(CreateUserDtoSchema, ctx.body);
    const existing = await this.users.findById(ctx.params.id);

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    if (await this.users.existsByEmail(payload.email, existing.id)) {
      throw new ConflictException("Email already in use");
    }

    return this.users.update(existing.id, payload)!;
  }

  async updateUser(ctx: HttpContext) {
    const payload = parseDto(UpdateUserDtoSchema, ctx.body);
    const existing = await this.users.findById(ctx.params.id);

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    if (
      payload.email &&
      (await this.users.existsByEmail(payload.email, existing.id))
    ) {
      throw new ConflictException("Email already in use");
    }

    return this.users.update(existing.id, payload)!;
  }

  async deleteUser(ctx: HttpContext) {
    const deleted = await this.users.delete(ctx.params.id);

    if (!deleted) {
      throw new NotFoundException("User not found");
    }

    return response(undefined, { status: 204 });
  }
}

function userSchema() {
  return {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      email: { type: "string", format: "email" },
      role: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    required: ["id", "name", "email", "role", "createdAt", "updatedAt"],
    additionalProperties: false,
  };
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
