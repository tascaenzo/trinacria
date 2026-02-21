export interface JwtClaims {
  sub: string;
  tokenType: "access" | "refresh";
  sid: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface JwtSigner {
  sign(
    payload: Omit<JwtClaims, "iat" | "exp">,
    expiresInSeconds: number,
  ): Promise<string>;
  verify(token: string): Promise<JwtClaims>;
}

export class JwtVerificationError extends Error {
  constructor(message = "Invalid or expired token") {
    super(message);
    this.name = "JwtVerificationError";
  }
}

export class Hs256JwtSigner implements JwtSigner {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  async sign(
    payload: Omit<JwtClaims, "iat" | "exp">,
    expiresInSeconds: number,
  ): Promise<string> {
    const { SignJWT } = await loadJose();

    return new SignJWT({
      tokenType: payload.tokenType,
      sid: payload.sid,
      email: payload.email,
      role: payload.role,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${expiresInSeconds}s`)
      .sign(this.secret);
  }

  async verify(token: string): Promise<JwtClaims> {
    const jose = await loadJose();

    try {
      const { payload } = await jose.jwtVerify(token, this.secret, {
        algorithms: ["HS256"],
      });

      return extractClaims(payload);
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new JwtVerificationError();
      }

      if (error instanceof jose.errors.JOSEError) {
        throw new JwtVerificationError();
      }

      throw error;
    }
  }
}

type JoseModule = typeof import("jose");

let joseModulePromise: Promise<JoseModule> | undefined;

function loadJose(): Promise<JoseModule> {
  if (!joseModulePromise) {
    joseModulePromise = import("jose");
  }

  return joseModulePromise;
}

function extractClaims(payload: Record<string, unknown>): JwtClaims {
  if (
    typeof payload.sub !== "string" ||
    (payload.tokenType !== "access" && payload.tokenType !== "refresh") ||
    typeof payload.sid !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    throw new JwtVerificationError("Invalid token claims");
  }

  return {
    sub: payload.sub,
    tokenType: payload.tokenType,
    sid: payload.sid,
    email: payload.email,
    role: payload.role,
    iat: payload.iat,
    exp: payload.exp,
  };
}
