import type { ModuleDefinition } from "./module-definition";
import type { Provider } from "../di/provider-types";
import type { Token } from "../token";
import { Container } from "../di/container";
import type { ProviderKind } from "../di";

export class ModuleRegistry {
  private readonly root: Container;
  private readonly moduleContainers = new Map<ModuleDefinition, Container>();

  /**
   * Indice logico per la discovery dei ProviderKind.
   * Non è un container DI.
   */
  private readonly kindIndex = new Map<symbol, Provider<any>[]>();

  constructor() {
    this.root = new Container();
  }

  // --------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------

  getRootContainer(): Container {
    return this.root;
  }

  build(rootModule: ModuleDefinition): void {
    this.buildModuleRecursive(rootModule);
  }

  /**
   * Inizializza tutti i container (eager).
   */
  async init(): Promise<void> {
    // 1️⃣ Init root
    await this.root.init();

    // 2️⃣ Init moduli
    for (const container of this.moduleContainers.values()) {
      await container.init();
    }

    // this.printTree();
  }

  /**
   * Discovery provider per ProviderKind.
   */
  getProvidersByKind<T>(kind: ProviderKind<T>): Provider<T>[] {
    return (this.kindIndex.get(kind.key) ?? []) as Provider<T>[];
  }

  // --------------------------------------------------
  // INTERNAL
  // --------------------------------------------------

  private buildModuleRecursive(module: ModuleDefinition): Container {
    if (this.moduleContainers.has(module)) {
      return this.moduleContainers.get(module)!;
    }

    // 1️⃣ Crea container modulo con parent = root
    const moduleContainer = new Container(this.root);
    this.moduleContainers.set(module, moduleContainer);

    // 2️⃣ Costruisci import prima
    const importedModules = module.imports ?? [];
    for (const imported of importedModules) {
      this.buildModuleRecursive(imported);
    }

    // 3️⃣ Registra provider locali
    const providers = module.providers ?? [];
    for (const provider of providers) {
      moduleContainer.register(provider);

      // 🔹 Indicizzazione per ProviderKind
      if (provider.kind) {
        this.indexProviderByKind(provider);
      }
    }

    // 4️⃣ Validazione visibilità
    this.validateModuleDependencies(module, moduleContainer, importedModules);

    // 5️⃣ Registra export nel root
    const exports = module.exports ?? [];
    for (const exportedToken of exports) {
      const provider = this.findLocalProvider(moduleContainer, exportedToken);

      if (!provider) {
        throw new Error(
          `Modulo "${module.name}" esporta token non registrato: ${describeToken(
            exportedToken,
          )}`,
        );
      }

      if (this.root.has(exportedToken)) {
        throw new Error(
          `Token ${describeToken(
            exportedToken,
          )} già esportato da un altro modulo.`,
        );
      }

      this.root.register(provider);
    }

    return moduleContainer;
  }

  private indexProviderByKind(provider: Provider<any>): void {
    const key = provider.kind!.key;

    const existing = this.kindIndex.get(key);

    if (existing) {
      // Evita duplicazioni
      if (!existing.some((p) => p.token.key === provider.token.key)) {
        existing.push(provider);
      }
    } else {
      this.kindIndex.set(key, [provider]);
    }
  }

  private validateModuleDependencies(
    module: ModuleDefinition,
    container: Container,
    importedModules: readonly ModuleDefinition[],
  ): void {
    const visibleTokens = new Set<symbol>();

    // Provider locali
    for (const provider of container.getProviders()) {
      visibleTokens.add(provider.token.key);
    }

    // Export moduli importati
    for (const importedModule of importedModules) {
      const exports = importedModule.exports ?? [];
      for (const token of exports) {
        visibleTokens.add(token.key);
      }
    }

    // Verifica deps
    for (const provider of container.getProviders()) {
      if (!("deps" in provider) || !provider.deps) continue;

      for (const dep of provider.deps) {
        if (!visibleTokens.has(dep.key)) {
          throw new Error(
            `Nel modulo "${module.name}", il provider ${describeToken(
              provider.token,
            )} usa token non visibile: ${describeToken(dep)}.`,
          );
        }
      }
    }
  }

  private findLocalProvider(
    container: Container,
    token: Token<any>,
  ): Provider<any> | undefined {
    return container.getProviders().find((p) => p.token.key === token.key);
  }

  // --------------------------------------------------
  // DEBUG
  // --------------------------------------------------
}

// --------------------------------------------------
// UTIL
// --------------------------------------------------

function describeToken(token: Token<any>): string {
  return token.description ?? token.key.toString();
}
