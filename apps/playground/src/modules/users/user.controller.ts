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
import { Readable } from "node:stream";
import { UserService } from "./user.service";

interface CreateUserPayload {
  name: string;
  email: string;
}

interface UpdateUserPayload {
  name?: string;
  email?: string;
}

const authMiddleware: HttpMiddleware = async (ctx, next) => {
  const authHeader = ctx.req.headers.authorization;

  if (authHeader !== "Bearer dev-token") {
    throw new UnauthorizedException("Missing or invalid token");
  }

  return next();
};

export class UserController extends HttpController {
  constructor(private readonly users: UserService) {
    super();
  }

  routes() {
    return this.router()
      .get("/examples/text", this.exampleText)
      .get("/examples/xml", "exampleXml")
      .get("/examples/csv", "exampleCsv")
      .get("/examples/html", "exampleHtml")
      .get("/examples/binary", "exampleBinary")
      .get("/examples/stream", "exampleStream")
      .get("/users", "listUsers")
      .get("/users/:id", "getUserById")
      .post("/users", "createUser", authMiddleware)
      .put("/users/:id", "replaceUser", authMiddleware)
      .patch("/users/:id", "updateUser", authMiddleware)
      .delete("/users/:id", "deleteUser", authMiddleware)
      .build();
  }

  async exampleText() {
    return response("Plain text example from Trinacria playground - Test\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  async exampleXml() {
    const items = this.users
      .list()
      .map(
        (user) =>
          `  <user id="${escapeXml(user.id)}"><name>${escapeXml(user.name)}</name><email>${escapeXml(user.email)}</email></user>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<users>\n${items}\n</users>\n`;

    return response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
      },
    });
  }

  async exampleCsv() {
    const header = "id,name,email,createdAt,updatedAt";
    const rows = this.users
      .list()
      .map((u) =>
        [u.id, u.name, u.email, u.createdAt, u.updatedAt]
          .map(escapeCsv)
          .join(","),
      );

    return response([header, ...rows].join("\n") + "\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'inline; filename="users.csv"',
      },
    });
  }

  async exampleHtml() {
    const users = this.users
      .list()
      .map(
        (u) =>
          `<li><strong>${escapeHtml(u.name)}</strong> - ${escapeHtml(u.email)}</li>`,
      )
      .join("");

    const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Trinacria Playground</title></head>
  <body>
    <h1>Users (HTML Example)</h1>
    <ul>${users}</ul>
  </body>
</html>`;

    return response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  async exampleBinary() {
    const binary = Buffer.from([
      0x54, 0x52, 0x49, 0x4e, 0x41, 0x43, 0x52, 0x49, 0x41,
    ]);

    return response(binary, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": 'attachment; filename="example.bin"',
      },
    });
  }

  async exampleStream() {
    const stream = Readable.from([
      "Trinacria stream example\n",
      "line 1\n",
      "line 2\n",
      "line 3\n",
    ]);

    return response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
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
    const payload = parseCreatePayload(ctx.body);

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
    const payload = parseCreatePayload(ctx.body);
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
    const payload = parseUpdatePayload(ctx.body);
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

function parseCreatePayload(body: unknown): CreateUserPayload {
  if (!isRecord(body)) {
    throw new BadRequestException("Body must be a JSON object");
  }

  const name = normalizeNonEmptyString(body.name, "name");
  const email = normalizeEmail(body.email, "email");

  return { name, email };
}

function parseUpdatePayload(body: unknown): UpdateUserPayload {
  if (!isRecord(body)) {
    throw new BadRequestException("Body must be a JSON object");
  }

  const payload: UpdateUserPayload = {};

  if ("name" in body) {
    payload.name = normalizeNonEmptyString(body.name, "name");
  }

  if ("email" in body) {
    payload.email = normalizeEmail(body.email, "email");
  }

  if (Object.keys(payload).length === 0) {
    throw new BadRequestException(
      "At least one field is required: name, email",
    );
  }

  return payload;
}

function normalizeEmail(value: unknown, field: string): string {
  const email = normalizeNonEmptyString(value, field).toLowerCase();

  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    throw new BadRequestException(`Field "${field}" must be a valid email`);
  }

  return email;
}

function normalizeNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new BadRequestException(`Field "${field}" must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(`Field "${field}" cannot be empty`);
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
