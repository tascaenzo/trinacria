import type { EventProvider } from "@trinacria/events";
import { EventsService } from "./events.service";

export const DEMO_EVENT_NAME = "events.demo";

export class EventsProvider implements EventProvider {
  constructor(private readonly eventsService: EventsService) {}

  subscriptions() {
    return [
      {
        event: DEMO_EVENT_NAME,
        handler: async (payload: unknown) => {
          if (
            payload &&
            typeof payload === "object" &&
            "message" in payload &&
            typeof payload.message === "string"
          ) {
            this.eventsService.add(DEMO_EVENT_NAME, {
              message: payload.message,
            });
          }
        },
      },
    ];
  }
}
