/**
 * @jest-environment node
 */

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
] as const;
const USER_SUBJECT = "google-user-123";

function readMigrationSql(fileName: string): string {
  return fs.readFileSync(path.join(DRIZZLE_DIRECTORY, fileName), "utf8");
}

function readLendersCatalogMigrationSql(): string {
  const migrationFileName = fs
    .readdirSync(DRIZZLE_DIRECTORY)
    .find((fileName) => /^0005_.*\.sql$/.test(fileName));

  if (!migrationFileName) {
    throw new Error(
      "Expected a 0005 migration that moves lenders catalog documents into normalized SQL rows.",
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

describe("lenders catalog SQL migration", () => {
  it("moves legacy lenders JSON rows into lenders_catalog before dropping lenders_catalog_documents", async () => {
    const client = createClient({
      url: "file::memory:",
    });
    await executeMigrations(client, BASE_MIGRATION_FILES);

    await client.execute({
      args: [
        JSON.stringify({
          lenders: [
            {
              id: " lender-2 ",
              name: " Papa ",
              notes: " Tarjeta ",
              type: "family",
            },
            {
              id: "lender-1",
              name: "Banco",
              type: "bank",
            },
          ],
        }),
        "2026-04-23T00:00:00.000Z",
        USER_SUBJECT,
      ],
      sql: `
        INSERT INTO lenders_catalog_documents (
          payload_json,
          updated_at_iso,
          user_subject
        )
        VALUES (?, ?, ?)
      `,
    });

    await client.executeMultiple(readLendersCatalogMigrationSql());

    const legacyTableRows = await client.execute({
      args: [],
      sql: `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'lenders_catalog_documents'
      `,
    });
    const lendersRows = await client.execute({
      args: [USER_SUBJECT],
      sql: `
        SELECT lender_id AS lenderId, name, notes, type
        FROM lenders_catalog
        WHERE user_subject = ?
        ORDER BY lender_id
      `,
    });

    expect(legacyTableRows.rows).toHaveLength(0);
    expect(lendersRows.rows).toEqual([
      {
        lenderId: "lender-1",
        name: "Banco",
        notes: null,
        type: "bank",
      },
      {
        lenderId: "lender-2",
        name: "Papa",
        notes: "Tarjeta",
        type: "family",
      },
    ]);
  });

  it("deduplicates repeated lender ids per user when migrating legacy JSON", async () => {
    const client = createClient({
      url: "file::memory:",
    });
    await executeMigrations(client, BASE_MIGRATION_FILES);

    await client.execute({
      args: [
        JSON.stringify({
          lenders: [
            {
              id: " lender-1 ",
              name: " Banco Viejo ",
              notes: " Nota vieja ",
              type: "bank",
            },
            {
              id: "lender-1",
              name: "Banco Actualizado",
              notes: " Nota nueva ",
              type: "bank",
            },
          ],
        }),
        "2026-04-23T00:00:00.000Z",
        USER_SUBJECT,
      ],
      sql: `
        INSERT INTO lenders_catalog_documents (
          payload_json,
          updated_at_iso,
          user_subject
        )
        VALUES (?, ?, ?)
      `,
    });

    await client.executeMultiple(readLendersCatalogMigrationSql());

    const lendersRows = await client.execute({
      args: [USER_SUBJECT],
      sql: `
        SELECT lender_id AS lenderId, name, notes, type
        FROM lenders_catalog
        WHERE user_subject = ?
      `,
    });

    expect(lendersRows.rows).toEqual([
      {
        lenderId: "lender-1",
        name: "Banco Actualizado",
        notes: "Nota nueva",
        type: "bank",
      },
    ]);
  });
});
