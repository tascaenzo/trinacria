export interface ResolvedConfig {
  entry: string;
  outDir: string;
  watchDir: string;
  env: "development" | "production" | string;
  crashLoopWindowMs: number;
  maxConsecutiveCrashRestarts: number;
}

export type TrinacriaConfig = Partial<ResolvedConfig>;
