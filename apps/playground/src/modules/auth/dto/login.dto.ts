import { Infer, s } from "@trinacria/schema";

export const LoginDtoSchema = s.object(
  {
    email: s.string({ trim: true, toLowerCase: true, email: true }),
    password: s.string({ minLength: 8, maxLength: 128 }),
  },
  { strict: true },
);

export type LoginDto = Infer<typeof LoginDtoSchema>;
