import { createToken } from "@trinacria/core";
import type { EventProvider } from "@trinacria/events";
import type { EventsController } from "./events.controller";
import type { EventsService } from "./events.service";
import type { EventsStore } from "./events.store";

export const EVENTS_STORE = createToken<EventsStore>("EVENTS_STORE");
export const EVENTS_SERVICE = createToken<EventsService>("EVENTS_SERVICE");
export const EVENTS_CONTROLLER =
  createToken<EventsController>("EVENTS_CONTROLLER");
export const EVENTS_PROVIDER = createToken<EventProvider>("EVENTS_PROVIDER");
