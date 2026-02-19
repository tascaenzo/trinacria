import type { HttpMiddleware } from "../../middleware/middleware-definition";

export type HeaderValue = string | false;
export type TrinacriaSecurityMode = "development" | "staging" | "production";
export type ValidationMode = "off" | "warn" | "strict";

export interface ReportToEndpoint {
  url: string;
}

export interface ReportToHeaderOptions {
  group?: string;
  maxAge: number;
  endpoints: ReportToEndpoint[];
  includeSubDomains?: boolean;
}

export interface ContentSecurityPolicyNonceOptions {
  enabled?: boolean;
  script?: boolean;
  style?: boolean;
  stateKey?: string;
  generator?: () => string;
}

export interface ContentSecurityPolicyOptions {
  directives?: Record<string, string[]>;
  overrideDirectives?: boolean;
  reportOnly?: boolean;
  reportUri?: string;
  reportTo?: string;
  reportToHeader?: ReportToHeaderOptions;
  nonce?: boolean | ContentSecurityPolicyNonceOptions;
  addStrictDynamicWhenNonce?: boolean;
  schemaValidation?: ValidationMode;
}

export interface StrictTransportSecurityOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

export type PermissionsPolicyValue = false | string | Record<string, string[]>;
export type ContentSecurityPolicyValue = false | ContentSecurityPolicyOptions;
export type StrictTransportSecurityValue =
  | false
  | StrictTransportSecurityOptions;

export interface SecurityHeadersOptions {
  mode?: TrinacriaSecurityMode;
  trustProxy?: boolean;
  headers?: Record<string, HeaderValue>;
  contentSecurityPolicy?: ContentSecurityPolicyValue;
  strictTransportSecurity?: StrictTransportSecurityValue;
  permissionsPolicy?: PermissionsPolicyValue;
  permissionsPolicyValidation?: ValidationMode;
  crossOriginEmbedderPolicy?: false | "unsafe-none" | "require-corp";
}

export type SecurityHeadersPreset =
  | "development"
  | "staging"
  | "production"
  | "enterprise";

export interface SecurityHeadersBuilder {
  preset(name: SecurityHeadersPreset): SecurityHeadersBuilder;
  mode(value: TrinacriaSecurityMode): SecurityHeadersBuilder;
  trustProxy(value: boolean): SecurityHeadersBuilder;
  headers(value: Record<string, HeaderValue>): SecurityHeadersBuilder;
  contentSecurityPolicy(
    value: ContentSecurityPolicyValue,
  ): SecurityHeadersBuilder;
  strictTransportSecurity(
    value: StrictTransportSecurityValue,
  ): SecurityHeadersBuilder;
  permissionsPolicy(
    value: PermissionsPolicyValue,
    validation?: ValidationMode,
  ): SecurityHeadersBuilder;
  crossOriginEmbedderPolicy(
    value: SecurityHeadersOptions["crossOriginEmbedderPolicy"],
  ): SecurityHeadersBuilder;
  buildOptions(): SecurityHeadersOptions;
  build(): HttpMiddleware;
}

export interface CompiledContentSecurityPolicy {
  name: string;
  build: () => {
    value: string;
    nonce?: string;
    nonceStateKey?: string;
  };
  reportToHeaderValue?: string;
}

export interface NormalizedContentSecurityPolicy {
  directives: Record<string, string[]>;
  reportOnly: boolean;
  nonceEnabled: boolean;
  nonceScript: boolean;
  nonceStyle: boolean;
  nonceStateKey: string;
  nonceGenerator: () => string;
  reportToHeaderValue?: string;
}
