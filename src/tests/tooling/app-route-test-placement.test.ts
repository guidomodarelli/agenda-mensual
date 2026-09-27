/** @vitest-environment node */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** App Router treats files under src/app as routing surface, so tests live in src/tests/app. */
const APP_ROUTER_DIRECTORY = path.join(process.cwd(), "src", "app");
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;

/**
 * Lists the test files below a directory, as paths relative to it with forward slashes.
 * @param directory - Directory to scan recursively.
 * @returns Relative paths of every test or spec file found.
 */
function findTestFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && TEST_FILE_PATTERN.test(entry.name))
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
}

describe("App Router test placement", () => {
  it("keeps every test file out of src/app", () => {
    expect(findTestFiles(APP_ROUTER_DIRECTORY)).toEqual([]);
  });

  it("finds test and spec files nested in route folders", () => {
    const routeDirectory = mkdtempSync(path.join(os.tmpdir(), "app-route-tests-"));
    try {
      mkdirSync(path.join(routeDirectory, "(finance)", "gastos"), { recursive: true });
      writeFileSync(path.join(routeDirectory, "page.tsx"), "");
      writeFileSync(path.join(routeDirectory, "(finance)", "gastos", "page.test.tsx"), "");
      writeFileSync(path.join(routeDirectory, "(finance)", "route.spec.ts"), "");

      expect(findTestFiles(routeDirectory)).toEqual([
        "(finance)/gastos/page.test.tsx",
        "(finance)/route.spec.ts",
      ]);
    } finally {
      rmSync(routeDirectory, { recursive: true, force: true });
    }
  });
});
