import type { EventRecord, EventsStore } from "./events.store";

export class EventsService {
  constructor(private readonly store: EventsStore) {}

  list(): EventRecord[] {
    return this.store.list();
  }

  add(
    name: string,
    payload: {
      message: string;
    },
  ): EventRecord {
    return this.store.add(name, payload);
  }
}
