import {
  HTTP_METHODS,
  type RouteDefinition,
  type HttpMethod,
} from "./route-definition";

export interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
}

interface RadixNode {
  segment: string;
  children: Map<string, RadixNode>;
  paramChild?: RadixNode;
  route?: RouteDefinition;
}

/**
 * Method-aware radix-tree router.
 * Each HTTP method owns a separate tree for O(path segments) lookup.
 */
export class Router {
  private readonly trees = new Map<HttpMethod, RadixNode>();

  constructor() {
    this.resetTrees();
  }

  clear(): void {
    this.resetTrees();
  }

  private resetTrees(): void {
    this.trees.clear();
    for (const method of HTTP_METHODS) {
      this.trees.set(method, this.createNode(""));
    }
  }

  register(route: RouteDefinition): void {
    const root = this.trees.get(route.method);
    if (!root) {
      throw new Error(`Unsupported HTTP method: ${route.method}`);
    }

    const segments = this.splitRoutePath(route.path);
    let current = root;

    for (const segment of segments) {
      // Param segment (e.g. :id)
      if (segment.startsWith(":")) {
        if (!current.paramChild) {
          current.paramChild = this.createNode(segment);
        }
        current = current.paramChild;
      } else {
        // Static segment
        if (!current.children.has(segment)) {
          current.children.set(segment, this.createNode(segment));
        }
        current = current.children.get(segment)!;
      }
    }

    if (current.route) {
      throw new Error(
        `Route already registered: [${route.method}] ${route.path}`,
      );
    }

    current.route = route;
  }

  match(method: HttpMethod, url: string): RouteMatch | null {
    const root = this.trees.get(method);
    if (!root) return null;

    const { pathname, query } = this.parseUrl(url);
    const segments = this.splitRequestPath(pathname);
    const resolved = this.resolveInTree(root, segments);

    if (!resolved?.route) {
      return null;
    }

    return {
      route: resolved.route,
      params: resolved.params,
      query,
    };
  }

  allowedMethods(url: string): HttpMethod[] {
    const { pathname } = this.parseUrl(url);
    const segments = this.splitRequestPath(pathname);
    const methods: HttpMethod[] = [];

    for (const method of HTTP_METHODS) {
      const root = this.trees.get(method);
      if (!root) continue;

      const resolved = this.resolveInTree(root, segments);
      if (resolved?.route) {
        methods.push(method);
      }
    }

    return methods;
  }

  private createNode(segment: string): RadixNode {
    return {
      segment,
      children: new Map(),
      paramChild: undefined,
      route: undefined,
    };
  }

  private parseUrl(url: string): {
    pathname: string;
    query: Record<string, string | string[]>;
  } {
    const parsed = new URL(url, "http://localhost");

    const query: Record<string, string | string[]> = {};

    for (const [key, value] of parsed.searchParams.entries()) {
      if (query[key]) {
        const existing = query[key];
        query[key] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
      } else {
        query[key] = value;
      }
    }

    const pathname = this.normalizePath(parsed.pathname);

    return { pathname, query };
  }

  private normalizePath(path: string): string {
    if (path.length > 1 && path.endsWith("/")) {
      return path.slice(0, -1);
    }

    return path;
  }

  private splitRoutePath(path: string): string[] {
    return this.normalizePath(path).split("/").filter(Boolean);
  }

  private splitRequestPath(path: string): string[] {
    return this.normalizePath(path)
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  }

  private resolveInTree(
    root: RadixNode,
    segments: string[],
  ): { route?: RouteDefinition; params: Record<string, string> } | null {
    let current = root;
    const params: Record<string, string> = {};

    for (const segment of segments) {
      if (current.children.has(segment)) {
        current = current.children.get(segment)!;
        continue;
      }

      if (current.paramChild) {
        const paramName = current.paramChild.segment.slice(1);
        params[paramName] = segment;
        current = current.paramChild;
        continue;
      }

      return null;
    }

    return { route: current.route, params };
  }
}
