import { s } from "@trinacria/schema";

export interface PublicUserDto {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PublicUserDtoSchema = s.objectOf<PublicUserDto>()(
  {
    id: s.string({ trim: true, minLength: 1 }),
    name: s.string({ trim: true, minLength: 1 }),
    email: s.string({ trim: true, toLowerCase: true, email: true }),
    createdAt: s.date(),
    updatedAt: s.date(),
  },
  { strict: true },
);

export const PublicUserListDtoSchema = s.array(PublicUserDtoSchema);
