import { s } from "@trinacria/schema";

export interface PublishEventDto {
  message: string;
}

export const PublishEventDtoSchema = s.objectOf<PublishEventDto>()(
  {
    message: s.string({ trim: true, minLength: 1, maxLength: 4_096 }),
  },
  { strict: true },
);
