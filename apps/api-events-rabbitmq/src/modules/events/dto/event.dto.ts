import { s } from "@trinacria/schema";

export interface EventDto {
  id: string;
  name: string;
  payload: {
    message: string;
  };
  receivedAt: Date;
}

export const EventDtoSchema = s.objectOf<EventDto>()(
  {
    id: s.string({ trim: true, minLength: 1 }),
    name: s.string({ trim: true, minLength: 1 }),
    payload: s.object({
      message: s.string({ trim: true, minLength: 1 }),
    }),
    receivedAt: s.date(),
  },
  { strict: true },
);

export const EventListDtoSchema = s.array(EventDtoSchema);
