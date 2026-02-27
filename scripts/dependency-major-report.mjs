#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";

function parseMajor(version) {
  const m = String(version || "").match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

function runOutdatedJson() {
  try {
    const out = execSync("npm outdated --json --long --workspaces --include-workspace-root", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim() ? JSON.parse(out) : {};
  } catch (error) {
    // npm outdated exits with code 1 when outdated deps are found. Use stdout anyway.
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout || "") : "";
    return stdout.trim() ? JSON.parse(stdout) : {};
  }
}

function collectEntries(node, out = []) {
  if (!node || typeof node !== "object") {
    return out;
  }

  const looksLikeOutdatedEntry =
    Object.prototype.hasOwnProperty.call(node, "current") &&
    Object.prototype.hasOwnProperty.call(node, "latest") &&
    Object.prototype.hasOwnProperty.call(node, "wanted");

  if (looksLikeOutdatedEntry) {
    out.push(node);
    return out;
  }

  for (const value of Object.values(node)) {
    collectEntries(value, out);
  }

  return out;
}

function findMajorUpdates(entries) {
  const majors = [];

  for (const entry of entries) {
    const currentMajor = parseMajor(entry.current);
    const latestMajor = parseMajor(entry.latest);
    if (currentMajor === null || latestMajor === null) {
      continue;
    }
    if (latestMajor > currentMajor) {
      majors.push({
        name: String(entry.name || entry.package || entry.dependent || "unknown"),
        current: String(entry.current),
        latest: String(entry.latest),
        wanted: String(entry.wanted),
        dependent: String(entry.dependent || "root"),
        type: String(entry.type || "unknown"),
      });
    }
  }

  return majors;
}

function uniqByKey(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

const outdated = runOutdatedJson();
const entries = collectEntries(outdated);
const majors = uniqByKey(findMajorUpdates(entries), (x) => `${x.dependent}:${x.name}`);

const report = {
  hasMajor: majors.length > 0,
  totalOutdated: entries.length,
  majors,
};

fs.mkdirSync(".tmp", { recursive: true });
fs.writeFileSync(".tmp/dependency-major-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify(report));
