/** @vitest-environment node */

import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  describeDatabaseHost,
  findPendingMigrations,
  mergeMigrationJournals,
  parseMigrationJournal,
  resolveMigrationConnection,
} from "../../../scripts/release/pending-migrations.mjs";
import { MIGRATION_STATUS } from "../../../scripts/release/release-plan.mjs";
import { collectReleaseState } from "../../../scripts/release/release-state.mjs";

/** Real Git fixtures with a bare remote can exceed the default timeout on Windows. */
const GIT_FIXTURE_TEST_TIMEOUT_MS = 60_000;

/** Git variables exported by hooks that would redirect fixture commands. */
const GIT_HOOK_ENVIRONMENT_VARIABLES = ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE", "GIT_PREFIX"];

const temporaryDirectories: string[] = [];

function createFixtureEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, HUSKY: "0" };

  for (const variableName of GIT_HOOK_ENVIRONMENT_VARIABLES) {
    delete environment[variableName];
  }

  return environment;
}

function runGit(gitArguments: string[], workingDirectory: string): string {
  const result = spawnSync("git", gitArguments, {
    cwd: workingDirectory,
    encoding: "utf8",
    env: createFixtureEnvironment(),
  });

  if (result.status !== 0) {
    throw new Error(`git ${gitArguments.join(" ")} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
}

function writeManifest(repositoryRoot: string, version: string): void {
  writeFileSync(path.join(repositoryRoot, "package.json"), `${JSON.stringify({ name: "fixture", version }, null, 2)}\n`);
}

function commitAll(repositoryRoot: string, message: string): void {
  runGit(["add", "-A"], repositoryRoot);
  runGit(["commit", "--quiet", "-m", message], repositoryRoot);
}

function writeJournal(repositoryRoot: string, entries: { tag: string; when: number }[]): void {
  const journalDirectory = path.join(repositoryRoot, "drizzle", "meta");
  mkdirSync(journalDirectory, { recursive: true });
  writeFileSync(path.join(journalDirectory, "_journal.json"), JSON.stringify({ entries }));
}

/** Creates a bare `origin` and a clone whose `main` holds a `0.1.0` release plus one feature commit. */
function createReleasedRepository(): { repositoryRoot: string; remoteRoot: string } {
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "release-state-"));
  temporaryDirectories.push(fixtureRoot);
  const remoteRoot = path.join(fixtureRoot, "origin.git");
  const repositoryRoot = path.join(fixtureRoot, "work");

  runGit(["init", "--quiet", "--bare", "--initial-branch=main", remoteRoot], fixtureRoot);
  runGit(["clone", "--quiet", remoteRoot, repositoryRoot], fixtureRoot);
  runGit(["config", "user.email", "release@example.test"], repositoryRoot);
  runGit(["config", "user.name", "Release Fixture"], repositoryRoot);
  runGit(["symbolic-ref", "HEAD", "refs/heads/main"], repositoryRoot);

  writeManifest(repositoryRoot, "0.1.0");
  writeJournal(repositoryRoot, [{ tag: "0000_baseline", when: 1 }]);
  commitAll(repositoryRoot, "0.1.0");
  writeFileSync(path.join(repositoryRoot, "feature.txt"), "waitlist\n");
  commitAll(repositoryRoot, "feat: add waitlist");
  runGit(["push", "--quiet", "origin", "main"], repositoryRoot);

  return { repositoryRoot, remoteRoot };
}

async function collect(repositoryRoot: string) {
  return collectReleaseState({
    repositoryRoot,
    checkMigrations: async ({ journalEntries }) => ({
      status: MIGRATION_STATUS.pending,
      pending: findPendingMigrations(journalEntries, 1),
      databaseHost: "db.example.test",
      reason: null,
    }),
  });
}

/**
 * Child process that seeds the Drizzle migrations table and runs the real
 * migration check. libSQL keeps a closed file database locked on Windows until
 * the process exits, so the check runs outside the Vitest worker to let the
 * fixture directory be removed.
 */
const PENDING_MIGRATION_CHECK_SCRIPT = `
  import { createClient } from "@libsql/client";
  import { pathToFileURL } from "node:url";
  const { modulePath, repositoryRoot, journalEntries, appliedCreatedAt } = JSON.parse(process.argv[1]);
  if (appliedCreatedAt !== null) {
    const client = createClient({ url: process.env.TURSO_DATABASE_URL });
    await client.execute("create table __drizzle_migrations (id integer primary key, hash text not null, created_at numeric)");
    await client.execute({ sql: "insert into __drizzle_migrations (hash, created_at) values ('seed', ?)", args: [appliedCreatedAt] });
    client.close();
  }
  const { checkPendingMigrations } = await import(pathToFileURL(modulePath).href);
  process.stdout.write(JSON.stringify(await checkPendingMigrations({ repositoryRoot, journalEntries })));
`;

/** Pending-migrations module exercised by the child process. */
const PENDING_MIGRATIONS_MODULE_PATH = path.resolve("scripts", "release", "pending-migrations.mjs");

/**
 * Runs the real migration check against a libSQL file database passed through
 * the shell environment, which wins over `.env`.
 */
function runPendingMigrationCheck(options: {
  repositoryRoot: string;
  databaseUrl: string;
  journalEntries: { tag: string; when: number }[];
  appliedCreatedAt: number | null;
}) {
  const { repositoryRoot, databaseUrl, journalEntries, appliedCreatedAt } = options;
  const payload = JSON.stringify({ modulePath: PENDING_MIGRATIONS_MODULE_PATH, repositoryRoot, journalEntries, appliedCreatedAt });
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", PENDING_MIGRATION_CHECK_SCRIPT, payload], {
    encoding: "utf8",
    env: { ...process.env, TURSO_DATABASE_URL: databaseUrl },
  });

  if (result.status !== 0) {
    throw new Error(`pending migration check failed: ${result.stderr}`);
  }

  return JSON.parse(result.stdout);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("release state", () => {
  it(
    "should report the last release commit and the commits published after it",
    async () => {
      const { repositoryRoot } = createReleasedRepository();

      const state = await collect(repositoryRoot);

      expect(state.currentBranch).toBe("main");
      expect(state.workingTreeChanges).toEqual([]);
      expect(state.lastRelease).toEqual({ sha: expect.any(String), version: "0.1.0" });
      expect(state.releasedVersion).toBe("0.1.0");
      expect(state.unreleasedCommits.map((commit) => commit.subject)).toEqual(["feat: add waitlist"]);
      expect(state.main).toEqual({ aheadCommits: [], behindCount: 0 });
      expect(state.unpushedRelease).toBeNull();
    },
    GIT_FIXTURE_TEST_TIMEOUT_MS
  );

  it(
    "should detect a local release commit that never reached origin",
    async () => {
      const { repositoryRoot } = createReleasedRepository();
      writeManifest(repositoryRoot, "0.2.0");
      commitAll(repositoryRoot, "0.2.0");

      const state = await collect(repositoryRoot);

      expect(state.unpushedRelease).toEqual({ version: "0.2.0", tag: "v0.2.0" });
    },
    GIT_FIXTURE_TEST_TIMEOUT_MS
  );

  it(
    "should see commits other clones pushed and migrations that are about to land",
    async () => {
      const { repositoryRoot, remoteRoot } = createReleasedRepository();
      const otherClone = path.join(path.dirname(remoteRoot), "other");
      runGit(["clone", "--quiet", remoteRoot, otherClone], path.dirname(remoteRoot));
      runGit(["config", "user.email", "other@example.test"], otherClone);
      runGit(["config", "user.name", "Other"], otherClone);
      writeJournal(otherClone, [
        { tag: "0000_baseline", when: 1 },
        { tag: "0001_add_waitlist", when: 2 },
      ]);
      commitAll(otherClone, "feat: add waitlist table");
      runGit(["push", "--quiet", "origin", "main"], otherClone);
      writeFileSync(path.join(repositoryRoot, "draft.txt"), "wip\n");

      const state = await collect(repositoryRoot);

      expect(state.main.behindCount).toBe(1);
      expect(state.unreleasedCommits).toHaveLength(2);
      expect(state.workingTreeChanges).toEqual(["?? draft.txt"]);
      expect(state.migrations.pending).toEqual(["0001_add_waitlist"]);
    },
    GIT_FIXTURE_TEST_TIMEOUT_MS
  );
});

describe("pending migrations", () => {
  it("should list journal entries newer than the last applied migration", () => {
    const journal = parseMigrationJournal(
      JSON.stringify({ entries: [{ tag: "b", when: 20 }, { tag: "a", when: 10 }, { tag: "c", when: 30 }] })
    );

    expect(findPendingMigrations(journal, 20)).toEqual(["c"]);
    expect(findPendingMigrations(journal, null)).toEqual(["a", "b", "c"]);
  });

  it("should merge journals from several revisions without duplicates", () => {
    expect(
      mergeMigrationJournals([
        [{ tag: "a", when: 1 }],
        [
          { tag: "a", when: 1 },
          { tag: "b", when: 2 },
        ],
      ]).map((entry) => entry.tag)
    ).toEqual(["a", "b"]);
  });

  it("should expose only the database host, never the credentials", () => {
    expect(describeDatabaseHost("libsql://user:secret@agenda-demo.turso.io?authToken=secret")).toBe(
      "agenda-demo.turso.io"
    );
    expect(describeDatabaseHost("file:./local.db")).toBe("./local.db (archivo local)");
    expect(describeDatabaseHost("not a url")).toBe("host desconocido");
  });

  it("should read the Turso connection from .env without overriding the shell environment", () => {
    const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), "release-env-"));
    temporaryDirectories.push(repositoryRoot);
    writeFileSync(
      path.join(repositoryRoot, ".env"),
      "TURSO_DATABASE_URL=libsql://from-file.turso.io\nTURSO_AUTH_TOKEN=file-token\n"
    );

    expect(resolveMigrationConnection(repositoryRoot, { TURSO_DATABASE_URL: "libsql://from-shell.turso.io" })).toEqual({
      url: "libsql://from-shell.turso.io",
      authToken: "file-token",
    });
  });

  it("should fall back to the local database like drizzle.config.ts when no URL is configured", () => {
    const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), "release-env-"));
    temporaryDirectories.push(repositoryRoot);

    expect(resolveMigrationConnection(repositoryRoot, {})).toEqual({ url: "file:./local.db", authToken: undefined });
  });

  describe("against a real libSQL database", () => {
    const journalEntries = [
      { tag: "0000_baseline", when: 1 },
      { tag: "0001_add_loans", when: 2 },
    ];

    function createDatabaseUrl(): { repositoryRoot: string; databaseUrl: string } {
      const repositoryRoot = mkdtempSync(path.join(os.tmpdir(), "release-db-"));
      temporaryDirectories.push(repositoryRoot);
      return { repositoryRoot, databaseUrl: pathToFileURL(path.join(repositoryRoot, "agenda.db")).href };
    }

    it(
      "should report every journal entry as pending when no migration was ever applied",
      () => {
        const { repositoryRoot, databaseUrl } = createDatabaseUrl();

        const result = runPendingMigrationCheck({ repositoryRoot, databaseUrl, journalEntries, appliedCreatedAt: null });

        expect(result.status).toBe(MIGRATION_STATUS.pending);
        expect(result.pending).toEqual(["0000_baseline", "0001_add_loans"]);
      },
      GIT_FIXTURE_TEST_TIMEOUT_MS
    );

    it(
      "should report only the journal entries newer than the last migration recorded by Drizzle",
      () => {
        const { repositoryRoot, databaseUrl } = createDatabaseUrl();

        const result = runPendingMigrationCheck({ repositoryRoot, databaseUrl, journalEntries, appliedCreatedAt: 1 });

        expect(result).toEqual({
          status: MIGRATION_STATUS.pending,
          pending: ["0001_add_loans"],
          databaseHost: expect.stringContaining("agenda.db (archivo local)"),
          reason: null,
        });
      },
      GIT_FIXTURE_TEST_TIMEOUT_MS
    );

    it(
      "should report the database as up to date when the last journal entry was applied",
      () => {
        const { repositoryRoot, databaseUrl } = createDatabaseUrl();

        const result = runPendingMigrationCheck({ repositoryRoot, databaseUrl, journalEntries, appliedCreatedAt: 2 });

        expect(result.status).toBe(MIGRATION_STATUS.upToDate);
        expect(result.pending).toEqual([]);
      },
      GIT_FIXTURE_TEST_TIMEOUT_MS
    );
  });
});
