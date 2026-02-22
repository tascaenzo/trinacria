import { s } from "@trinacria/schema";

export const AuthUserDtoSchema = s.object(
  {
    id: s.string(),
    name: s.string(),
    email: s.string({ email: true }),
    role: s.string(),
  },
  { strict: true },
);

export const AuthResultDtoSchema = s.object(
  {
    accessToken: s.string(),
    csrfToken: s.string(),
    tokenType: s.string(),
    expiresIn: s.number(),
    user: AuthUserDtoSchema,
  },
  { strict: true },
);
