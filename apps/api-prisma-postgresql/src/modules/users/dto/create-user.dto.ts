import { s } from "@trinacria/schema";

export interface CreateUserDto {
  name: string;
  email: string;
}

export const CreateUserDtoSchema = s.objectOf<CreateUserDto>()(
  {
    name: s.string({ trim: true, minLength: 1 }),
    email: s.string({ trim: true, toLowerCase: true, email: true }),
  },
  { strict: true },
);
