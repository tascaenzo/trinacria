import type { RouteDefinition } from "../routing/route-definition";

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
}

export interface OpenApiRouteEntry {
  route: RouteDefinition;
  controllerName: string;
}

export interface BuildOpenApiDocumentOptions {
  title: string;
  version: string;
  description?: string;
  routes: OpenApiRouteEntry[];
}

export function buildOpenApiDocument(
  options: BuildOpenApiDocumentOptions,
): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const entry of options.routes) {
    const route = entry.route;
    if (route.docs?.excludeFromOpenApi) {
      continue;
    }

    const openApiPath = route.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const method = route.method.toLowerCase();
    const docs = route.docs;

    const operation: Record<string, unknown> = {
      operationId:
        docs?.operationId ??
        `${entry.controllerName}.${route.handlerName ?? `${method}${openApiPath}`}`,
      summary: docs?.summary ?? `${route.method} ${route.path}`,
      tags: docs?.tags ?? [entry.controllerName],
      responses: buildResponses(docs),
    };

    if (docs?.description) {
      operation.description = docs.description;
    }

    if (docs?.deprecated) {
      operation.deprecated = true;
    }

    if (docs?.security) {
      operation.security = docs.security;
    }

    const pathParameters = extractPathParameters(openApiPath);
    if (pathParameters.length > 0) {
      operation.parameters = pathParameters;
    }

    if (docs?.requestBody) {
      operation.requestBody = buildRequestBody(docs.requestBody);
    }

    const existingPath = paths[openApiPath] ?? {};
    existingPath[method] = operation;
    paths[openApiPath] = existingPath;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: options.title,
      version: options.version,
      ...(options.description ? { description: options.description } : {}),
    },
    paths,
  };
}

function buildRequestBody(
  requestBody: NonNullable<RouteDefinition["docs"]>["requestBody"],
) {
  const contentType = requestBody?.contentType ?? "application/json";
  const schema = requestBody?.schema ?? { type: "object" };

  return {
    required: requestBody?.required ?? false,
    ...(requestBody?.description
      ? { description: requestBody.description }
      : {}),
    content: {
      [contentType]: {
        schema,
      },
    },
  };
}

function buildResponses(
  docs: RouteDefinition["docs"] | undefined,
): Record<string, unknown> {
  if (!docs?.responses || Object.keys(docs.responses).length === 0) {
    return {
      200: { description: "Success" },
    };
  }

  const responses: Record<string, unknown> = {};
  for (const [statusCode, response] of Object.entries(docs.responses)) {
    const contentType = response.contentType ?? "application/json";
    responses[statusCode] = {
      description: response.description,
      ...(response.schema
        ? {
            content: {
              [contentType]: {
                schema: response.schema,
              },
            },
          }
        : {}),
    };
  }

  return responses;
}

function extractPathParameters(path: string): Array<Record<string, unknown>> {
  const matches = [...path.matchAll(/\{([A-Za-z0-9_]+)\}/g)];
  return matches.map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}
