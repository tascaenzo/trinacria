import { s } from "@trinacria/schema";

export interface UpdateUserDto {
  name?: string;
  email?: string;
}

export const UpdateUserDtoSchema = s.objectOf<UpdateUserDto>()(
  {
    name: s.string({ trim: true, minLength: 1 }).optional(),
    email: s.string({ trim: true, toLowerCase: true, email: true }).optional(),
  },
  {
    strict: true,
    minProperties: 1,
  },
);
