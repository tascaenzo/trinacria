import { ConsoleLogger } from "@trinacria/core";
import type { EventProvider } from "@trinacria/events";

export class UserEventsProvider implements EventProvider {
  private readonly logger = new ConsoleLogger("playground:user-events");

  subscriptions() {
    return [
      {
        event: "users.created",
        handler: async (payload: unknown) => {
          this.logger.info(
            `users.created id=${String((payload as { id?: string }).id ?? "n/a")}`,
          );
        },
      },
      {
        event: "users.updated",
        handler: async (payload: unknown) => {
          this.logger.info(
            `users.updated id=${String((payload as { id?: string }).id ?? "n/a")}`,
          );
        },
      },
      {
        event: "users.deleted",
        handler: async (payload: unknown) => {
          this.logger.info(
            `users.deleted id=${String((payload as { id?: string }).id ?? "n/a")}`,
          );
        },
      },
    ];
  }
}
