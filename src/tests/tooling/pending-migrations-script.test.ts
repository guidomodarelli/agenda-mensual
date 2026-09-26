/** @vitest-environment node */

import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  MIGRATION_STATUS,
  describeDatabaseHost,
  findPendingMigrations,
  mergeMigrationJournals,
  parseMigrationJournal,
  readMigrationJournalAt,
  resolveMigrationConnection,
} from "../../../scripts/release/pending-migrations.mjs";
import {
  GIT_FIXTURE_TEST_TIMEOUT_MS,
  createFixtureGitReader,
  createRepositoryWithIncomingMigration,
} from "./release-git-fixture";

const temporaryDirectories: string[] = [];

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

  it(
    "should merge the journals of the branch and of migrations about to land on origin/main",
    async () => {
      const { fixtureRoot, repositoryRoot } = createRepositoryWithIncomingMigration();
      temporaryDirectories.push(fixtureRoot);

      const journalEntries = await readMigrationJournalAt(createFixtureGitReader(repositoryRoot), [
        "HEAD",
        "origin/main",
        "missing-revision",
      ]);

      expect(journalEntries.map((entry) => entry.tag)).toEqual(["0000_baseline", "0001_add_waitlist"]);
    },
    GIT_FIXTURE_TEST_TIMEOUT_MS
  );

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
          target: expect.stringContaining("agenda.db (archivo local)"),
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

    it(
      "should report the check as unknown, without throwing, when the database cannot be queried",
      () => {
        const { repositoryRoot } = createDatabaseUrl();

        const result = runPendingMigrationCheck({
          repositoryRoot,
          databaseUrl: pathToFileURL(path.join(repositoryRoot, "missing-folder", "agenda.db")).href,
          journalEntries,
          appliedCreatedAt: null,
        });

        expect(result.status).toBe(MIGRATION_STATUS.unknown);
        expect(result.pending).toEqual([]);
        expect(result.reason).toMatch(/^falló la consulta a /);
      },
      GIT_FIXTURE_TEST_TIMEOUT_MS
    );
  });
});
