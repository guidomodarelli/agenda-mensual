/**
 * @vitest-environment node
 */

import { describe, it, expect } from "vitest";
import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const DRIZZLE_DIRECTORY = path.resolve(process.cwd(), "drizzle");
const BASE_MIGRATION_FILES = [
  "0000_early_karnak.sql",
  "0001_naive_pretty_boy.sql",
  "0002_minor_vision.sql",
  "0003_global_expense_identity.sql",
  "0004_migrate_monthly_expenses_documents.sql",
  "0005_smiling_saracen.sql",
  "0006_light_lenny_balinger.sql",
] as const;

function readMigrationSql(fileName: string): string {
  return fs.readFileSync(path.join(DRIZZLE_DIRECTORY, fileName), "utf8");
}

function readUserRegistrationTracesMigrationSql(): string {
  const migrationFileName = fs
    .readdirSync(DRIZZLE_DIRECTORY)
    .find((fileName) => /^0007_.*\.sql$/.test(fileName));

  if (!migrationFileName) {
    throw new Error(
      "Expected a 0007 migration that creates user registration traces table.",
    );
  }

  return readMigrationSql(migrationFileName);
}

async function executeMigrations(
  client: Client,
  migrationFileNames: readonly string[],
): Promise<void> {
  for (const migrationFileName of migrationFileNames) {
    await client.executeMultiple(readMigrationSql(migrationFileName));
  }
}

describe("user registration traces SQL migration", () => {
  it("creates the traceability table with constraints and indexes", async () => {
    const client = createClient({
      url: "file::memory:",
    });
    await executeMigrations(client, BASE_MIGRATION_FILES);

    await client.executeMultiple(readUserRegistrationTracesMigrationSql());

    const tableInfo = await client.execute({
      args: [],
      sql: "PRAGMA table_info('user_registration_traces')",
    });
    const indexInfo = await client.execute({
      args: [],
      sql: "PRAGMA index_list('user_registration_traces')",
    });

    expect(tableInfo.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "user_subject",
          notnull: 1,
          pk: 1,
        }),
        expect.objectContaining({
          name: "auth_provider",
          notnull: 1,
        }),
        expect.objectContaining({
          name: "registration_email",
          notnull: 1,
        }),
        expect.objectContaining({
          name: "registered_at_iso",
          notnull: 1,
        }),
        expect.objectContaining({
          name: "last_verified_at_iso",
          notnull: 1,
        }),
      ]),
    );
    expect(indexInfo.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "user_registration_traces_registration_email_idx",
        }),
        expect.objectContaining({
          name: "user_registration_traces_auth_provider_idx",
        }),
      ]),
    );
  });
});
