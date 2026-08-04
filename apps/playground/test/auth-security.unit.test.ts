import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@trinacria/http";
import { ConfigService } from "../src/global-service/config.service";
import { AuthGuardFactory } from "../src/modules/auth/auth-guard.factory";
import { Hs256JwtSigner, JwtVerificationError } from "../src/modules/auth/jwt";

const claims = {
  sub: "user-1",
  tokenType: "access" as const,
  sid: "session-1",
  email: "user@example.com",
  role: "USER",
};

test("JWTs are bound to the configured issuer and audience", async () => {
  const signer = new Hs256JwtSigner(
    "a-secure-test-secret-with-at-least-32-bytes",
    "trinacria-test",
    "trinacria-api",
  );
  const token = await signer.sign(claims, 60);

  const verified = await signer.verify(token);
  assert.equal(verified.sub, claims.sub);
  assert.equal(verified.sid, claims.sid);

  const wrongAudience = new Hs256JwtSigner(
    "a-secure-test-secret-with-at-least-32-bytes",
    "trinacria-test",
    "another-api",
  );
  await assert.rejects(() => wrongAudience.verify(token), JwtVerificationError);
});

test("role middleware rejects missing and insufficient authentication state", async () => {
  const factory = new AuthGuardFactory({} as never);
  const requireAdmin = factory.requireRoles("ADMIN");
  const next = async () => "next";

  await assert.rejects(
    () => requireAdmin({ state: {} } as never, next),
    UnauthorizedException,
  );
  await assert.rejects(
    () =>
      requireAdmin(
        { state: { auth: { ...claims, iat: 1, exp: 2 } } } as never,
        next,
      ),
    ForbiddenException,
  );

  const result = await requireAdmin(
    {
      state: { auth: { ...claims, role: "ADMIN", iat: 1, exp: 2 } },
    } as never,
    next,
  );
  assert.equal(result, "next");
});

test("non-development configuration rejects placeholder secrets", () => {
  const keys = [
    "ENV",
    "DATABASE_URL",
    "SECRET_KEY",
    "CORS_ALLOWED_ORIGINS",
    "OPENAPI_ENABLED",
  ] as const;
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  try {
    process.env.ENV = "staging";
    process.env.DATABASE_URL = "file:./test.db";
    process.env.SECRET_KEY = "change-me";
    process.env.CORS_ALLOWED_ORIGINS = "https://app.example.com";
    process.env.OPENAPI_ENABLED = "false";

    assert.throws(() => new ConfigService(), /at least 32 bytes/);

    process.env.SECRET_KEY = "a-secure-staging-secret-with-at-least-32-bytes";
    assert.doesNotThrow(() => new ConfigService());
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
