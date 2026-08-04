import type { EventBus } from "@trinacria/events";
import { type HttpContext, HttpController, response } from "@trinacria/http";
import { EventListDtoSchema, PublishEventDtoSchema } from "./dto";
import { DEMO_EVENT_NAME } from "./events.provider";
import type { EventsService } from "./events.service";

export class EventsController extends HttpController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventBus: EventBus,
  ) {
    super();
  }

  routes() {
    return this.router()
      .get("/health", this.healthCheck, {
        docs: {
          tags: ["Health"],
          summary: "Health check",
        },
      })
      .get("/events", this.listEvents, {
        docs: {
          tags: ["Events"],
          summary: "List consumed events",
          responses: {
            200: {
              description: "Consumed events",
              schema: EventListDtoSchema.toOpenApi(),
            },
          },
        },
      })
      .post("/events/publish", this.publishEvent, {
        docs: {
          tags: ["Events"],
          summary: "Publish demo event to Redis transport",
          requestBody: {
            required: true,
            schema: PublishEventDtoSchema.toOpenApi(),
          },
          responses: {
            202: {
              description: "Event accepted",
            },
          },
        },
      })
      .build();
  }

  healthCheck() {
    return { status: "ok" };
  }

  listEvents() {
    return this.eventsService.list();
  }

  async publishEvent(ctx: HttpContext) {
    const payload = PublishEventDtoSchema.parse(ctx.body);

    await this.eventBus.emit(DEMO_EVENT_NAME, {
      message: payload.message,
    });

    return response(
      {
        status: "accepted",
        event: DEMO_EVENT_NAME,
      },
      { status: 202 },
    );
  }
}
