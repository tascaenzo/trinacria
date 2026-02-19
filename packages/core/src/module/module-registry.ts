import type { ModuleDefinition } from "./module-definition";
import type { FactoryProvider, Provider } from "../di/provider-types";
import type { Token } from "../token";
import { Container } from "../di/container";
import type { ProviderKind } from "../di";
import {
  ModuleDependencyError,
  ModuleExportError,
  ModuleUnregistrationError,
  TokenConflictError,
} from "../errors";

export interface ModuleGraphNode {
  name: string;
  imports: string[];
  exports: string[];
  providers: string[];
}

export interface ModuleGraphSnapshot {
  modules: ModuleGraphNode[];
  providerKinds: Record<string, number>;
}

/**
 * Builds module container graphs and manages exported-token visibility.
 * Also maintains a ProviderKind index so plugins can discover providers by capability.
 */
export class ModuleRegistry {
  private readonly root: Container;
  private readonly moduleContainers = new Map<ModuleDefinition, Container>();
  private readonly moduleImports = new Map<
    ModuleDefinition,
    Set<ModuleDefinition>
  >();
  private readonly globalTokens = new Set<symbol>();

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

  registerGlobalProvider(provider: Provider): void {
    this.root.register(provider);
    this.globalTokens.add(provider.token.key);
  }

  build(rootModule: ModuleDefinition): void {
    this.buildModuleRecursive(rootModule);
  }

  async unregister(module: ModuleDefinition): Promise<void> {
    const container = this.moduleContainers.get(module);
    if (!container) {
      return;
    }

    const dependents = this.moduleImports.get(module);
    if (dependents && dependents.size > 0) {
      const dependentNames = Array.from(dependents)
        .map((item) => item.name)
        .sort()
        .join(", ");

      throw new ModuleDependencyError(
        `Cannot unregister module "${module.name}" because it is imported by: ${dependentNames}.`,
      );
    }

    try {
      await container.destroy();
    } catch (error) {
      throw new ModuleUnregistrationError(
        `Failed to destroy providers while unregistering module "${module.name}": ${toErrorMessage(error)}`,
      );
    }

    // Remove exported providers from root visibility.
    const exports = module.exports ?? [];
    for (const exportedToken of exports) {
      await this.root.unregisterAndDestroy(exportedToken, true);
    }

    // Remove module providers from ProviderKind discovery index.
    for (const provider of module.providers ?? []) {
      this.unindexProviderByKind(provider);
    }

    // Remove non-exported providers from the module container.
    for (const provider of container.getProviders()) {
      container.unregister(provider.token, true);
    }

    // Remove reverse-import links created by this module.
    for (const imported of module.imports ?? []) {
      const importers = this.moduleImports.get(imported);
      if (!importers) continue;

      importers.delete(module);
      if (importers.size === 0) {
        this.moduleImports.delete(imported);
      }
    }

    this.moduleImports.delete(module);
    this.moduleContainers.delete(module);
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

  async destroy(): Promise<void> {
    const errors: unknown[] = [];

    for (const container of this.moduleContainers.values()) {
      try {
        await container.destroy();
      } catch (error) {
        errors.push(error);
      }
    }

    try {
      await this.root.destroy();
    } catch (error) {
      errors.push(error);
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        "One or more containers failed to destroy.",
      );
    }
  }

  describeGraph(): ModuleGraphSnapshot {
    const modules = Array.from(this.moduleContainers.entries()).map(
      ([module, container]) => ({
        name: module.name,
        imports: (module.imports ?? []).map((item) => item.name).sort(),
        exports: (module.exports ?? [])
          .map((token) => describeToken(token))
          .sort(),
        providers: container
          .getProviders()
          .map((provider) => describeToken(provider.token))
          .sort(),
      }),
    );

    const providerKinds: Record<string, number> = {};

    for (const [key, providers] of this.kindIndex.entries()) {
      providerKinds[key.toString()] = providers.length;
    }

    return {
      modules: modules.sort((a, b) => a.name.localeCompare(b.name)),
      providerKinds,
    };
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
      this.linkModuleImport(module, imported);
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
    this.validateModuleDependencies(module, providers, importedModules);

    // 5) Re-export selected tokens into the root container via lazy aliases.
    const exports = module.exports ?? [];
    for (const exportedToken of exports) {
      const provider = this.findLocalProvider(moduleContainer, exportedToken);

      if (!provider) {
        throw new ModuleExportError(
          `Module "${module.name}" exports an unregistered token: ${describeToken(
            exportedToken,
          )}`,
        );
      }

      if (this.root.has(exportedToken)) {
        throw new TokenConflictError(
          `Token ${describeToken(exportedToken)} is already exported by another module.`,
        );
      }

      const rootAliasProvider: FactoryProvider<any> = {
        token: exportedToken,
        kind: provider.kind,
        deps: [],
        useFactory: () => moduleContainer.resolve(exportedToken),
        eager: false,
        lifecycle: "external",
      };

      // Root container can already be initialized when modules are added at runtime.
      this.root.register(rootAliasProvider, true);
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

  private unindexProviderByKind(provider: Provider<any>): void {
    if (!provider.kind) return;

    const key = provider.kind.key;
    const existing = this.kindIndex.get(key);
    if (!existing) return;

    const filtered = existing.filter((p) => p.token.key !== provider.token.key);
    if (filtered.length === 0) {
      this.kindIndex.delete(key);
      return;
    }

    this.kindIndex.set(key, filtered);
  }

  private linkModuleImport(
    importer: ModuleDefinition,
    imported: ModuleDefinition,
  ): void {
    const importers = this.moduleImports.get(imported);
    if (importers) {
      importers.add(importer);
      return;
    }

    this.moduleImports.set(imported, new Set([importer]));
  }

  private validateModuleDependencies(
    module: ModuleDefinition,
    moduleProviders: readonly Provider[],
    importedModules: readonly ModuleDefinition[],
  ): void {
    const visibleTokens = new Set<symbol>();

    // Local providers are always visible inside their own module.
    for (const provider of moduleProviders) {
      visibleTokens.add(provider.token.key);
    }

    // Exports from imported modules are also visible.
    for (const importedModule of importedModules) {
      const exports = importedModule.exports ?? [];
      for (const token of exports) {
        visibleTokens.add(token.key);
      }
    }

    // Global providers are visible in every module scope.
    for (const tokenKey of this.globalTokens) {
      visibleTokens.add(tokenKey);
    }

    // Verify that each declared dependency is visible in module scope.
    for (const provider of moduleProviders) {
      if (!("deps" in provider) || !provider.deps) continue;

      for (const dep of provider.deps) {
        if (!visibleTokens.has(dep.key)) {
          throw new ModuleDependencyError(
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
