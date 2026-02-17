import { Plugin } from "./plugin-lifecycle";

/**
 * Typed factory used to declare plugins.
 * It improves inference and keeps the core DSL consistent.
 */
export function definePlugin<T extends Plugin>(plugin: T): Readonly<T> {
  return plugin;
}
