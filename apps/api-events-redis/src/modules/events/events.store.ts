import { randomUUID } from "node:crypto";

export interface EventRecord {
  id: string;
  name: string;
  payload: {
    message: string;
  };
  receivedAt: Date;
}

const MAX_EVENTS = 100;

export class EventsStore {
  private readonly events: EventRecord[] = [];

  add(
    name: string,
    payload: {
      message: string;
    },
  ): EventRecord {
    const entry: EventRecord = {
      id: randomUUID(),
      name,
      payload,
      receivedAt: new Date(),
    };

    this.events.unshift(entry);

    if (this.events.length > MAX_EVENTS) {
      this.events.length = MAX_EVENTS;
    }

    return entry;
  }

  list(): EventRecord[] {
    return [...this.events];
  }
}
