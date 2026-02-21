import { s } from "@trinacria/schema";

export interface PublicUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export const PublicUserDtoSchema = s.objectOf<PublicUserDto>()(
  {
    id: s.string(),
    name: s.string(),
    email: s.string({ email: true }),
    role: s.string(),
    createdAt: s.dateTimeString(),
    updatedAt: s.dateTimeString(),
  },
  { strict: true },
);

export const PublicUserListDtoSchema = s.array(PublicUserDtoSchema);
