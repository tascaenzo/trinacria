import {
  ConflictException,
  HttpController,
  HttpContext,
  response,
} from "@trinacria/http";
import { UsersService } from "./users.service";
import {
  CreateUserDtoSchema,
  PublicUserDtoSchema,
  PublicUserListDtoSchema,
} from "./dto";

export class UsersController extends HttpController {
  constructor(private readonly users: UsersService) {
    super();
  }

  routes() {
    return this.router()
      .get("/health", () => ({ status: "ok" }), {
        docs: {
          tags: ["Health"],
          summary: "Health check",
        },
      })
      .get("/users", this.listUsers, {
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
      .post("/users", this.createUser, {
        docs: {
          tags: ["Users"],
          summary: "Create user",
          requestBody: {
            required: true,
            schema: CreateUserDtoSchema.toOpenApi(),
          },
          responses: {
            201: {
              description: "Created user",
              schema: PublicUserDtoSchema.toOpenApi(),
            },
            409: {
              description: "Email already exists",
            },
          },
        },
      })
      .build();
  }

  async listUsers() {
    return this.users.list();
  }

  async createUser(ctx: HttpContext) {
    const payload = CreateUserDtoSchema.parse(ctx.body);

    try {
      const created = await this.users.create(payload);
      return response(created, {
        status: 201,
        headers: {
          location: `/users/${created.id}`,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new ConflictException("Email already exists");
      }

      throw error;
    }
  }
}
