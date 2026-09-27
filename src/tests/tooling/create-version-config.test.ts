/** @vitest-environment node */

import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import createVersionConfig from "../../../beez-rp.config.mjs";
import { MIGRATION_STATUS } from "../../../scripts/release/pending-migrations.mjs";
import {
  GIT_FIXTURE_TEST_TIMEOUT_MS,
  createFixtureGitReader,
  createRepositoryWithIncomingMigration,
} from "./release-git-fixture";

/** `beez-rp create-version` configuration exercised by the child process. */
const CONFIG_MODULE_PATH = path.resolve("beez-rp.config.mjs");

/**
 * Child process that runs the configured `migrations.check` with a Git reader
 * bound to the fixture, like `beez-rp create-version` does. libSQL keeps a file
 * database locked on Windows until the process exits, so the check runs outside
 * the Vitest worker to let the fixture directory be removed.
 */
const CONFIGURED_MIGRATION_CHECK_SCRIPT = `
  import { spawnSync } from "node:child_process";
  import { pathToFileURL } from "node:url";
  const { configPath, repositoryRoot } = JSON.parse(process.argv[1]);
  const tryGit = async (gitArguments) => {
    const result = spawnSync("git", gitArguments, { cwd: repositoryRoot, encoding: "utf8" });
    return result.status === 0 ? result.stdout.trimEnd() : null;
  };
  const { default: config } = await import(pathToFileURL(configPath).href);
  const context = { repositoryRoot, version: null, git: { git: tryGit, tryGit }, run: async () => 1, print: () => {}, fail: () => { throw new Error("unexpected fail"); } };
  process.stdout.write(JSON.stringify(await config.migrations.check(context)));
`;

const temporaryDirectories: string[] = [];

/** Failure raised by the `fail` helper of the hook context double. */
class HookFailure extends Error {
  constructor(message: string, readonly hint: string) {
    super(message);
  }
}

/**
 * Hook context with the `beez-rp create-version` contract whose `run` records
 * the command lines and answers with the given exit code.
 */
function createHookContext(repositoryRoot: string, exitCode: number) {
  const commandLines: string[] = [];

  return {
    commandLines,
    context: {
      repositoryRoot,
      version: null,
      git: createFixtureGitReader(repositoryRoot),
      run: async (commandLine: string) => {
        commandLines.push(commandLine);
        return exitCode;
      },
      print: () => {},
      fail: (message: string, hint: string): never => {
        throw new HookFailure(message, hint);
      },
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("create-version configuration", () => {
  it(
    "should check the database against the migrations of the branch and of origin/main",
    () => {
      const { fixtureRoot, repositoryRoot } = createRepositoryWithIncomingMigration();
      temporaryDirectories.push(fixtureRoot);
      const databaseUrl = pathToFileURL(path.join(fixtureRoot, "agenda.db")).href;

      const result = spawnSync(
        process.execPath,
        ["--input-type=module", "--eval", CONFIGURED_MIGRATION_CHECK_SCRIPT, JSON.stringify({ configPath: CONFIG_MODULE_PATH, repositoryRoot })],
        { encoding: "utf8", env: { ...process.env, TURSO_DATABASE_URL: databaseUrl } }
      );

      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        status: MIGRATION_STATUS.pending,
        pending: ["0000_baseline", "0001_add_waitlist"],
        target: expect.stringContaining("agenda.db (archivo local)"),
        reason: null,
      });
    },
    GIT_FIXTURE_TEST_TIMEOUT_MS
  );

  it("should apply the migrations with the push-migrations script", async () => {
    const { commandLines, context } = createHookContext(process.cwd(), 0);

    await createVersionConfig.migrations?.apply(context);

    expect(commandLines).toEqual([expect.stringContaining("scripts/push-migrations.mjs")]);
  });

  it("should stop the release step when the migration command fails", async () => {
    const { context } = createHookContext(process.cwd(), 3);

    await expect(createVersionConfig.migrations?.apply(context)).rejects.toThrow(
      "drizzle-kit migrate falló con código 3."
    );
  });
});
