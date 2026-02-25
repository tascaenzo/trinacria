/** @type {import('@trinacria/cli').TrinacriaConfig} */

const config = {
  entry: "src/main.ts",
  outDir: "dist",
  watchDir: "src",
  env: "development",
  crashLoopWindowMs: 15_000,
  maxConsecutiveCrashRestarts: 3,
};

export default config;
