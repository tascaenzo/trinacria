import {
  type ApplicationContext,
  createToken,
  definePlugin,
  type ModuleDefinition,
  type Plugin,
  valueProvider,
} from "@trinacria/core";

import { InternalEventBus } from "./bus/internal-event-bus";
import type {
  EventBus,
  EventPluginOptions,
  EventProvider,
  EventSubscription,
} from "./contracts";
import { EVENT_PROVIDER_KIND } from "./provider";

export const EVENT_BUS_TOKEN = createToken<EventBus>("EVENT_BUS_TOKEN");

/**
 * Creates an internal event-bus plugin.
 * It discovers providers tagged with `EVENT_PROVIDER_KIND`.
 */
export function createEventsPlugin(options: EventPluginOptions = {}): Plugin {
  const bus =
    options.bus ??
    new InternalEventBus({
      stopOnError: options.stopOnError,
      onListenerError: options.onListenerError,
      onDispatchSkippedDuplicate: options.onDispatchSkippedDuplicate,
      onHealthChange: options.onHealthChange,
      validateEnvelope: options.validateEnvelope,
      transport: options.transport,
      dispatchLocalOnEmit: options.dispatchLocalOnEmit,
      source: options.source,
      version: options.version,
      headers: options.headers,
      connectRetry: options.retry?.connect,
      publishRetry: options.retry?.publish,
      idempotency: options.idempotency,
    });

  async function rebuildSubscriptions(app: ApplicationContext): Promise<void> {
    const subscriptions = await loadSubscriptionsFromProviders(app);
    bus.replaceManagedSubscriptions(subscriptions);
  }

  return definePlugin({
    name: "plugin:events",

    onRegister(app: ApplicationContext): void {
      app.registerGlobalProvider(valueProvider(EVENT_BUS_TOKEN, bus));
    },

    async onInit(app: ApplicationContext): Promise<void> {
      await bus.start?.();
      await rebuildSubscriptions(app);
    },

    async onModuleRegistered(
      _module: ModuleDefinition,
      app: ApplicationContext,
    ): Promise<void> {
      await rebuildSubscriptions(app);
    },

    async onModuleUnregistered(
      _module: ModuleDefinition,
      app: ApplicationContext,
    ): Promise<void> {
      await rebuildSubscriptions(app);
    },

    async onDestroy(): Promise<void> {
      await bus.stop?.();
      bus.clear();
    },
  });
}

async function loadSubscriptionsFromProviders(
  app: ApplicationContext,
): Promise<EventSubscription[]> {
  const providers = app.getProvidersByKind(EVENT_PROVIDER_KIND);
  const subscriptions: EventSubscription[] = [];

  for (const provider of providers) {
    const instance = await app.resolve(provider.token);
    const eventProvider = instance as EventProvider;
    const provided = eventProvider.subscriptions();

    subscriptions.push(...(Array.isArray(provided) ? provided : [provided]));
  }

  return subscriptions;
}
