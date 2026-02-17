import type { ModuleDefinition } from "./module-definition";
import type { Provider } from "../di/provider-types";
import type { Token } from "../token";
import { Container } from "../di/container";
import type { ProviderKind } from "../di";

/**
 * Builds module container graphs and manages exported-token visibility.
 * Also maintains a ProviderKind index so plugins can discover providers by capability.
 */
export class ModuleRegistry {
  private readonly root: Container;
  private readonly moduleContainers = new Map<ModuleDefinition, Container>();

  /**
   * Logical index used for ProviderKind discovery.
   * This is metadata lookup, not a DI container.
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
   * Eagerly initializes root and module containers.
   */
  async init(): Promise<void> {
    // 1) Initialize root container first.
    await this.root.init();

    // 2) Initialize each module container.
    for (const container of this.moduleContainers.values()) {
      await container.init();
    }

    // this.printTree();
  }

  /**
   * Returns all providers registered under a given ProviderKind.
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

    // 1) Create module container with root as parent scope.
    const moduleContainer = new Container(this.root);
    this.moduleContainers.set(module, moduleContainer);

    // 2) Build imported modules first.
    const importedModules = module.imports ?? [];
    for (const imported of importedModules) {
      this.buildModuleRecursive(imported);
    }

    // 3) Register local module providers.
    const providers = module.providers ?? [];
    for (const provider of providers) {
      moduleContainer.register(provider);

      // Add provider to kind index for plugin discovery.
      if (provider.kind) {
        this.indexProviderByKind(provider);
      }
    }

    // 4) Validate dependency visibility boundaries.
    this.validateModuleDependencies(module, moduleContainer, importedModules);

    // 5) Re-export selected tokens into the root container.
    const exports = module.exports ?? [];
    for (const exportedToken of exports) {
      const provider = this.findLocalProvider(moduleContainer, exportedToken);

      if (!provider) {
        throw new Error(
          `Module "${module.name}" exports an unregistered token: ${describeToken(
            exportedToken,
          )}`,
        );
      }

      if (this.root.has(exportedToken)) {
        throw new Error(
          `Token ${describeToken(exportedToken)} is already exported by another module.`,
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
      // Avoid duplicate entries for the same token.
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

    // Local providers are always visible inside their own module.
    for (const provider of container.getProviders()) {
      visibleTokens.add(provider.token.key);
    }

    // Exports from imported modules are also visible.
    for (const importedModule of importedModules) {
      const exports = importedModule.exports ?? [];
      for (const token of exports) {
        visibleTokens.add(token.key);
      }
    }

    // Verify that each declared dependency is visible in module scope.
    for (const provider of container.getProviders()) {
      if (!("deps" in provider) || !provider.deps) continue;

      for (const dep of provider.deps) {
        if (!visibleTokens.has(dep.key)) {
          throw new Error(
            `In module "${module.name}", provider ${describeToken(
              provider.token,
            )} depends on non-visible token: ${describeToken(dep)}.`,
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
