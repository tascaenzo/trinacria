import type { ResolvedConfig } from "./config.contract.js";

export const defaultConfig: ResolvedConfig = {
  entry: "src/main.ts",
  outDir: "dist",
  watchDir: "src",
  env: "development",
  crashLoopWindowMs: 15_000,
  maxConsecutiveCrashRestarts: 3,
};
