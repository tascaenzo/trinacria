import { classProvider, defineModule } from "@trinacria/core";
import { EVENT_BUS_TOKEN, eventProvider } from "@trinacria/events";
import { httpProvider } from "@trinacria/http";
import { EventsController } from "./events.controller";
import { EventsProvider } from "./events.provider";
import { EventsService } from "./events.service";
import { EventsStore } from "./events.store";
import {
  EVENTS_CONTROLLER,
  EVENTS_PROVIDER,
  EVENTS_SERVICE,
  EVENTS_STORE,
} from "./events.tokens";

export const EventsModule = defineModule({
  name: "EventsModule",
  providers: [
    classProvider(EVENTS_STORE, EventsStore),
    classProvider(EVENTS_SERVICE, EventsService, [EVENTS_STORE]),
    httpProvider(EVENTS_CONTROLLER, EventsController, [
      EVENTS_SERVICE,
      EVENT_BUS_TOKEN,
    ]),
    eventProvider(EVENTS_PROVIDER, EventsProvider, [EVENTS_SERVICE]),
  ],
  exports: [EVENTS_SERVICE, EVENTS_CONTROLLER, EVENTS_PROVIDER],
});
