import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nativeVersion = require("typescript/package.json").version;
const cliRequire = createRequire(
  new URL("../packages/cli/package.json", import.meta.url),
);
const compilerApiVersion = cliRequire("typescript").version;

assertMajor("TypeScript native compiler", nativeVersion, 7);
assertMajor("TypeScript compatibility API", compilerApiVersion, 6);

console.log(
  `TypeScript toolchain verified: native=${nativeVersion}, compatibility-api=${compilerApiVersion}`,
);

function assertMajor(label, version, expectedMajor) {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (major !== expectedMajor) {
    throw new Error(
      `${label} must be major ${expectedMajor}, resolved ${version}`,
    );
  }
}
