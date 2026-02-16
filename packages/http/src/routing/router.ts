import type { RouteDefinition, HttpMethod } from "./route-definition";

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

export class Router {
  private readonly trees = new Map<HttpMethod, RadixNode>();

  constructor() {
    // Inizializziamo una root per ogni metodo HTTP
    const methods: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    for (const method of methods) {
      this.trees.set(method, this.createNode(""));
    }
  }

  register(route: RouteDefinition): void {
    const root = this.trees.get(route.method);
    if (!root) {
      throw new Error(`Unsupported HTTP method: ${route.method}`);
    }

    const segments = this.splitPath(route.path);
    let current = root;

    for (const segment of segments) {
      // Param segment (:id)
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
    const segments = this.splitPath(pathname);

    let current = root;
    const params: Record<string, string> = {};

    for (const segment of segments) {
      // Priorità segmento statico
      if (current.children.has(segment)) {
        current = current.children.get(segment)!;
        continue;
      }

      // Fallback su parametro dinamico
      if (current.paramChild) {
        const paramName = current.paramChild.segment.slice(1);
        params[paramName] = segment;
        current = current.paramChild;
        continue;
      }

      return null;
    }

    if (!current.route) {
      return null;
    }

    return {
      route: current.route,
      params,
      query,
    };
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

    let pathname = parsed.pathname;

    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    return { pathname, query };
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter(Boolean);
  }
}
