import { ResolvedConfig } from "./config.contract.js";

export const defaultConfig: ResolvedConfig = {
  entry: "src/main.ts",
  outDir: "dist",
  watchDir: "src",
  env: "development",
};
