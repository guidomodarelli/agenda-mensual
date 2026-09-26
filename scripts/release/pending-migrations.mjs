/**
 * Detects versioned SQL migrations that the configured Turso/libSQL database
 * has not applied yet, using the same rule as `drizzle-kit migrate`: a journal
 * entry is pending when its `when` timestamp is newer than the latest
 * `created_at` stored in `__drizzle_migrations`.
 *
 * The connection is resolved exactly like `drizzle.config.ts` under
 * `drizzle-kit` (`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, with `.env`
 * loaded without overriding the shell environment, falling back to the local
 * `file:./local.db`), so the check always targets the database that
 * `pnpm run push-migrations` would change. Only the host is ever shown.
 *
 * `beez-rp.config.mjs` plugs this adapter into `beez-rp create-version`; the
 * result follows the `MigrationCheck` contract of that command.
 *
 * @module pending-migrations
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** Result of checking the database, as `beez-rp create-version` expects it. */
export const MIGRATION_STATUS = Object.freeze({
  upToDate: "up-to-date",
  pending: "pending",
  unknown: "unknown",
});

/** Drizzle journal that lists every versioned migration. */
export const MIGRATION_JOURNAL_PATH = "drizzle/meta/_journal.json";

/** Environment file loaded by `drizzle-kit` (dotenv default). */
const ENVIRONMENT_FILE_NAME = ".env";

/** Environment variable with the database URL read by `drizzle.config.ts`. */
const DATABASE_URL_ENVIRONMENT_VARIABLE = "TURSO_DATABASE_URL";

/** Environment variable with the database auth token read by `drizzle.config.ts`. */
const DATABASE_AUTH_TOKEN_ENVIRONMENT_VARIABLE = "TURSO_AUTH_TOKEN";

/** Database used by `drizzle.config.ts` when no URL is configured. */
const DEFAULT_DATABASE_URL = "file:./local.db";

/** URL protocol of a local SQLite file. */
const FILE_URL_PROTOCOL = "file:";

/** Latest migration applied by Drizzle Kit (default migrations table). */
const LAST_APPLIED_MIGRATION_QUERY = "select created_at from __drizzle_migrations order by created_at desc limit 1";

/** SQLite error text for a missing table (no migration ever applied). */
const MISSING_TABLE_ERROR_PATTERN = /no such table/i;

/** Placeholder shown when the host cannot be derived from the URL. */
const UNKNOWN_HOST_LABEL = "host desconocido";

/**
 * Parses the Drizzle journal JSON into its migration entries.
 *
 * @param {string} journalText - Contents of `_journal.json`.
 * @returns {{ tag: string, when: number }[]} Entries ordered by `when`.
 */
export function parseMigrationJournal(journalText) {
  const journal = JSON.parse(journalText);

  return (journal.entries ?? [])
    .map((entry) => ({ tag: entry.tag, when: Number(entry.when) }))
    .sort((left, right) => left.when - right.when);
}

/**
 * Merges several journals (for example `origin/main` and the feature branch)
 * so migrations that are about to land are also considered.
 *
 * @param {{ tag: string, when: number }[][]} journals - Parsed journals.
 * @returns {{ tag: string, when: number }[]} Unique entries ordered by `when`.
 */
export function mergeMigrationJournals(journals) {
  const entriesByTag = new Map();

  for (const entry of journals.flat()) {
    entriesByTag.set(entry.tag, entry);
  }

  return [...entriesByTag.values()].sort((left, right) => left.when - right.when);
}

/**
 * Reads the migration journal at several revisions and merges them, so
 * migrations committed on the branch and on `origin/main` are both checked.
 * A revision without a journal is skipped.
 *
 * @param {{ tryGit: (gitArguments: string[]) => Promise<string | null> }} gitReader - Git reader of the repository.
 * @param {string[]} revisions - Revisions to read, such as `HEAD` and `origin/main`.
 * @returns {Promise<{ tag: string, when: number }[]>} Merged journal entries.
 */
export async function readMigrationJournalAt(gitReader, revisions) {
  const journals = [];

  for (const revision of revisions) {
    const journalText = await gitReader.tryGit(["show", `${revision}:${MIGRATION_JOURNAL_PATH}`]);

    if (journalText) {
      journals.push(parseMigrationJournal(journalText));
    }
  }

  return mergeMigrationJournals(journals);
}

/**
 * Lists journal entries newer than the last migration applied by Drizzle.
 *
 * @param {{ tag: string, when: number }[]} journalEntries - Journal entries.
 * @param {number | null} lastAppliedCreatedAt - Latest `created_at`, or `null` when nothing was applied.
 * @returns {string[]} Tags of the pending migrations.
 */
export function findPendingMigrations(journalEntries, lastAppliedCreatedAt) {
  return journalEntries
    .filter((entry) => lastAppliedCreatedAt === null || entry.when > lastAppliedCreatedAt)
    .map((entry) => entry.tag);
}

/**
 * Resolves the database connection the same way `drizzle-kit` does with
 * `drizzle.config.ts`: `.env` values never override the shell environment.
 *
 * @param {string} repositoryRoot - Repository root with the `.env` file.
 * @param {Record<string, string | undefined>} [environment] - Environment to read and complete.
 * @returns {{ url: string, authToken: string | undefined }} Database connection.
 */
export function resolveMigrationConnection(repositoryRoot, environment = process.env) {
  const environmentFilePath = path.join(repositoryRoot, ENVIRONMENT_FILE_NAME);

  if (existsSync(environmentFilePath)) {
    const fileValues = parseEnv(readFileSync(environmentFilePath, "utf8"));

    for (const [variableName, value] of Object.entries(fileValues)) {
      environment[variableName] ??= value;
    }
  }

  return {
    url: environment[DATABASE_URL_ENVIRONMENT_VARIABLE]?.trim() || DEFAULT_DATABASE_URL,
    authToken: environment[DATABASE_AUTH_TOKEN_ENVIRONMENT_VARIABLE]?.trim() || undefined,
  };
}

/**
 * Describes the database target without credentials: the host of a remote
 * URL or the file of a local SQLite database.
 *
 * @param {string} databaseUrl - libSQL URL such as `libsql://db.turso.io` or `file:./local.db`.
 * @returns {string} Host or local file, or a placeholder when it cannot be parsed.
 */
export function describeDatabaseHost(databaseUrl) {
  try {
    const url = new URL(databaseUrl);

    if (url.protocol === FILE_URL_PROTOCOL) {
      return `${databaseUrl.slice(FILE_URL_PROTOCOL.length)} (archivo local)`;
    }

    return url.hostname || UNKNOWN_HOST_LABEL;
  } catch {
    return UNKNOWN_HOST_LABEL;
  }
}

/**
 * Reads the latest `created_at` recorded by Drizzle Kit.
 *
 * @param {{ url: string, authToken: string | undefined }} connection - Database connection.
 * @returns {Promise<number | null>} Timestamp in ms, or `null` when no migration was applied.
 */
async function queryLastAppliedMigration(connection) {
  const { createClient } = await import("@libsql/client");
  const client = createClient(connection);

  try {
    const result = await client.execute(LAST_APPLIED_MIGRATION_QUERY);
    const createdAt = result.rows[0]?.created_at;

    return createdAt === undefined || createdAt === null ? null : Number(createdAt);
  } catch (error) {
    if (MISSING_TABLE_ERROR_PATTERN.test(error?.message ?? "")) {
      return null;
    }

    throw error;
  } finally {
    client.close();
  }
}

/**
 * Checks which migrations of the given journal are missing in the database.
 * Never throws: an unreachable or misconfigured database is reported as
 * {@link MIGRATION_STATUS.unknown} so the release can still continue.
 *
 * @param {{ repositoryRoot: string, journalEntries: { tag: string, when: number }[] }} options - Inputs.
 * @returns {Promise<{ status: string, pending: string[], target: string | null, reason: string | null }>} Result;
 *   `target` is the database host (or local file), never its credentials.
 */
export async function checkPendingMigrations({ repositoryRoot, journalEntries }) {
  let connection;

  try {
    connection = resolveMigrationConnection(repositoryRoot);
  } catch (error) {
    return {
      status: MIGRATION_STATUS.unknown,
      pending: [],
      target: null,
      reason: `no se pudo leer ${ENVIRONMENT_FILE_NAME} (${error?.message ?? "error desconocido"})`,
    };
  }

  const databaseHost = describeDatabaseHost(connection.url);

  try {
    const lastAppliedCreatedAt = await queryLastAppliedMigration(connection);
    const pending = findPendingMigrations(journalEntries, lastAppliedCreatedAt);

    return {
      status: pending.length > 0 ? MIGRATION_STATUS.pending : MIGRATION_STATUS.upToDate,
      pending,
      target: databaseHost,
      reason: null,
    };
  } catch (error) {
    return {
      status: MIGRATION_STATUS.unknown,
      pending: [],
      target: databaseHost,
      reason: `falló la consulta a ${databaseHost} (${error?.code ?? error?.message ?? "error desconocido"})`,
    };
  }
}
