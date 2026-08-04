import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  loadEnvironmentFiles,
  parseEnvironmentFile,
} from "../src/config/environment-files";

test("parseEnvironmentFile handles quotes, export and invalid keys", () => {
  assert.deepEqual(
    {
      ...parseEnvironmentFile(
        'A=one\nexport B=two\nC="three four"\n# comment\nBAD-KEY=x\n',
      ),
    },
    { A: "one", B: "two", C: "three four" },
  );
});

test("loadEnvironmentFiles keeps deployment values and applies environment overrides", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "trinacria-env-"));
  try {
    fs.writeFileSync(path.join(root, ".env"), "A=base\nB=base\n");
    fs.writeFileSync(
      path.join(root, ".env.production"),
      "B=production\nC=prod\n",
    );
    const target = { ENV: "production", A: "deployment" } as NodeJS.ProcessEnv;

    loadEnvironmentFiles({ roots: [root], target });

    assert.equal(target.A, "deployment");
    assert.equal(target.B, "production");
    assert.equal(target.C, "prod");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
