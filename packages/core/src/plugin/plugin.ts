import { Plugin } from "./plugin-lifecycle";

/**
 * Factory tipizzata per definire un plugin.
 * Serve per migliorare l'inferenza e mantenere coerenza con il DSL del core.
 */
export function definePlugin<T extends Plugin>(plugin: T): Readonly<T> {
  return plugin;
}
