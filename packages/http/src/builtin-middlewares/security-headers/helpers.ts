import type { IncomingMessage, ServerResponse } from "node:http";
import type { TrinacriaSecurityMode } from "./types";

export function hasResponseHeader(res: ServerResponse, name: string): boolean {
  if (typeof res.hasHeader === "function" && res.hasHeader(name)) {
    return true;
  }

  if (typeof res.getHeaders !== "function") {
    return false;
  }

  const target = name.toLowerCase();
  return Object.keys(res.getHeaders()).some(
    (key) => key.toLowerCase() === target,
  );
}

export function resolveMode(
  mode: TrinacriaSecurityMode | undefined,
): TrinacriaSecurityMode {
  if (mode) return mode;
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "staging") return "staging";
  return "development";
}

export function isHttpsRequest(
  req: IncomingMessage,
  trustProxy: boolean,
): boolean {
  if ("encrypted" in req.socket && Boolean(req.socket.encrypted)) {
    return true;
  }

  if (!trustProxy) {
    return false;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) {
    return false;
  }

  const value = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;
  return value.split(",")[0]?.trim().toLowerCase() === "https";
}

export function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export function addSourceToken(existing: string[], source: string): string[] {
  return existing.includes(source) ? existing : [...existing, source];
}

export function renderDirective(directive: string, sources: string[]): string {
  if (sources.length === 0) {
    return directive;
  }

  return `${directive} ${sources.join(" ")}`;
}

export function renderCsp(entries: Array<[string, string[]]>): string {
  return entries
    .map(([directive, sources]) => renderDirective(directive, sources))
    .join("; ");
}
