export interface ResolvedConfig {
  entry: string;
  outDir: string;
  watchDir: string;
  env: "development" | "production" | string;
}

export type TrinacriaConfig = Partial<ResolvedConfig>;
