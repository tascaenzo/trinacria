import type { EventBus } from "@trinacria/events";
import {
  ConflictException,
  ForbiddenException,
  type HttpContext,
  HttpController,
  NotFoundException,
  response,
} from "@trinacria/http";
import type { AuthGuardFactory } from "../auth/auth-guard.factory";
import type { JwtClaims } from "../auth/jwt";
import {
  CreateUserDtoSchema,
  PublicUserDtoSchema,
  PublicUserListDtoSchema,
  UpdateUserDtoSchema,
} from "./dto";
import type { UserService } from "./user.service";

export class UserController extends HttpController {
  constructor(
    private readonly users: UserService,
    private readonly authGuardFactory: AuthGuardFactory,
    private readonly eventBus: EventBus,
  ) {
    super();
  }

  routes() {
    const protectedRoute = this.authGuardFactory.requireProtectedRoute();
    const adminOnly = this.authGuardFactory.requireRoles("admin");

    return this.router()
      .get("/users", this.listUsers, {
        middlewares: [protectedRoute, adminOnly],
        docs: {
          tags: ["Users"],
          summary: "List users",
          responses: {
            200: {
              description: "Users list",
              schema: PublicUserListDtoSchema.toOpenApi(),
            },
          },
        },
      })
      .get("/users/:id", this.getUserById, {
        middlewares: [protectedRoute],
        docs: {
          tags: ["Users"],
          summary: "Get user by id",
          responses: {
            200: {
              description: "User",
              schema: PublicUserDtoSchema.toOpenApi(),
            },
            404: {
              description: "User not found",
            },
          },
        },
      })
      .post("/users", this.createUser, {
        middlewares: [protectedRoute, adminOnly],
        docs: {
          tags: ["Users"],
          summary: "Create user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [], csrfHeader: [] },
          ],
          requestBody: {
            required: true,
            schema: CreateUserDtoSchema.toOpenApi(),
          },
          responses: {
            201: {
              description: "Created user",
              schema: PublicUserDtoSchema.toOpenApi(),
            },
          },
        },
      })
      .put("/users/:id", this.replaceUser, {
        middlewares: [protectedRoute],
        docs: {
          tags: ["Users"],
          summary: "Replace user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [], csrfHeader: [] },
          ],
          requestBody: {
            required: true,
            schema: CreateUserDtoSchema.toOpenApi(),
          },
          responses: {
            200: {
              description: "Updated user",
              schema: PublicUserDtoSchema.toOpenApi(),
            },
          },
        },
      })
      .patch("/users/:id", this.updateUser, {
        middlewares: [protectedRoute],
        docs: {
          tags: ["Users"],
          summary: "Patch user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [], csrfHeader: [] },
          ],
          requestBody: {
            required: true,
            schema: UpdateUserDtoSchema.toOpenApi(),
          },
          responses: {
            200: {
              description: "Updated user",
              schema: PublicUserDtoSchema.toOpenApi(),
            },
          },
        },
      })
      .delete("/users/:id", this.deleteUser, {
        middlewares: [protectedRoute],
        docs: {
          tags: ["Users"],
          summary: "Delete user",
          security: [
            { bearerAuth: [] },
            { accessTokenCookie: [], csrfHeader: [] },
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
    this.assertCanAccessUser(ctx, ctx.params.id);
    const user = await this.users.findById(ctx.params.id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async createUser(ctx: HttpContext) {
    const payload = CreateUserDtoSchema.parse(ctx.body);

    if (await this.users.existsByEmail(payload.email)) {
      throw new ConflictException("Email already in use");
    }

    const created = await this.users.create(payload);
    await this.eventBus.emit("users.created", {
      id: created.id,
      email: created.email,
      createdAt: created.createdAt,
    });

    return response(created, {
      status: 201,
      headers: {
        location: `/users/${created.id}`,
      },
    });
  }

  async replaceUser(ctx: HttpContext) {
    this.assertCanAccessUser(ctx, ctx.params.id);
    const payload = CreateUserDtoSchema.parse(ctx.body);
    const existing = await this.users.findById(ctx.params.id);

    if (!existing) {
      throw new NotFoundException("User not found");
    }

    if (await this.users.existsByEmail(payload.email, existing.id)) {
      throw new ConflictException("Email already in use");
    }

    const updated = await this.users.update(existing.id, payload);
    if (!updated) {
      throw new NotFoundException("User not found");
    }

    await this.eventBus.emit("users.updated", {
      id: updated.id,
      email: updated.email,
      updatedAt: updated.updatedAt,
    });
    return updated;
  }

  async updateUser(ctx: HttpContext) {
    this.assertCanAccessUser(ctx, ctx.params.id);
    const payload = UpdateUserDtoSchema.parse(ctx.body);
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

    const updated = await this.users.update(existing.id, payload);
    if (!updated) {
      throw new NotFoundException("User not found");
    }

    await this.eventBus.emit("users.updated", {
      id: updated.id,
      email: updated.email,
      updatedAt: updated.updatedAt,
    });
    return updated;
  }

  async deleteUser(ctx: HttpContext) {
    this.assertCanAccessUser(ctx, ctx.params.id);
    const deleted = await this.users.delete(ctx.params.id);

    if (!deleted) {
      throw new NotFoundException("User not found");
    }

    await this.eventBus.emit("users.deleted", {
      id: deleted.id,
      email: deleted.email,
      deletedAt: new Date().toISOString(),
    });

    return response(undefined, { status: 204 });
  }

  private assertCanAccessUser(ctx: HttpContext, userId: string): void {
    const auth = ctx.state.auth as JwtClaims | undefined;
    if (!auth) {
      throw new ForbiddenException("Authentication context is missing");
    }
    if (auth.role !== "admin" && auth.sub !== userId) {
      throw new ForbiddenException("You cannot access another user");
    }
  }
}
