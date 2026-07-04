import { createProviderKind } from "@trinacria/core";
import type { EventProvider } from "../contracts";

/**
 * ProviderKind marker used by the events plugin to discover subscribers.
 */
export const EVENT_PROVIDER_KIND =
  createProviderKind<EventProvider>("event:provider");
