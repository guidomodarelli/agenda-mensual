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
] as const;
const DUPLICATED_EXPENSE_ID = "duplicated-expense-id";
const USER_SUBJECT = "user-subject";
const LEGACY_MONTH = "2026-04";
const EMPTY_LEGACY_MONTH = "2026-05";

function readMigrationSql(fileName: string): string {
  return fs.readFileSync(path.join(DRIZZLE_DIRECTORY, fileName), "utf8");
}

function readMonthlyExpensesDocumentsMigrationSql(): string {
  const migrationFileName = fs
    .readdirSync(DRIZZLE_DIRECTORY)
    .find((fileName) =>
      /^0004_.*\.sql$/.test(fileName),
    );

  if (!migrationFileName) {
    throw new Error(
      "Expected a 0004 migration that moves monthly expenses documents into normalized SQL rows.",
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

async function insertLegacyMonthlyExpensesDocument({
  client,
  month,
  payload,
  updatedAtIso,
}: {
  client: Client;
  month: string;
  payload: unknown;
  updatedAtIso: string;
}): Promise<void> {
  await client.execute({
    args: [month, JSON.stringify(payload), updatedAtIso, USER_SUBJECT],
    sql: `
      INSERT INTO monthly_expenses_documents (
        month,
        payload_json,
        updated_at_iso,
        user_subject
      )
      VALUES (?, ?, ?, ?)
    `,
  });
}

describe("monthly expenses documents SQL migration", () => {
  it("moves legacy JSON documents into normalized SQL rows before dropping the legacy table", async () => {
    const client = createClient({
      url: "file::memory:",
    });
    await executeMigrations(client, BASE_MIGRATION_FILES);
    await client.execute({
      args: [
        "2026-04T00:00:00.000Z",
        "ARS",
        "Stale normalized expense",
        "stale-expense-id",
        "2026-04T00:00:00.000Z",
        USER_SUBJECT,
      ],
      sql: `
        INSERT INTO expenses (
          created_at_iso,
          currency,
          description,
          expense_id,
          updated_at_iso,
          user_subject
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    });
    await client.execute({
      args: [
        "stale-expense-id",
        LEGACY_MONTH,
        1,
        10,
        "2026-04T00:00:00.000Z",
        USER_SUBJECT,
      ],
      sql: `
        INSERT INTO expense_months (
          expense_id,
          month,
          occurrences_per_month,
          subtotal,
          updated_at_iso,
          user_subject
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    });
    await insertLegacyMonthlyExpensesDocument({
      client,
      month: LEGACY_MONTH,
      payload: {
        exchangeRateSnapshot: {
          blueRate: 1200,
          month: LEGACY_MONTH,
          officialRate: 1000,
          solidarityRate: 1300,
        },
        items: [
          {
            currency: "ARS",
            description: "Duplicated expense A",
            id: DUPLICATED_EXPENSE_ID,
            manualCoveredPayments: 1,
            occurrencesPerMonth: 2,
            receipts: [
              {
                allReceiptsFolderId: "all-receipts-folder-a",
                allReceiptsFolderViewUrl: "https://drive.google.com/a",
                coveredPayments: 1,
                fileId: "receipt-a",
                fileName: "receipt-a.pdf",
                fileViewUrl: "https://drive.google.com/file-a",
                monthlyFolderId: "monthly-folder-a",
                monthlyFolderViewUrl: "https://drive.google.com/month-a",
                registeredAt: "2026-04-03T12:00:00.000Z",
              },
            ],
            subtotal: 100,
          },
          {
            currency: "USD",
            description: "Duplicated expense B",
            id: DUPLICATED_EXPENSE_ID,
            occurrencesPerMonth: 1,
            paymentRecords: [
              {
                coveredPayments: 1,
                id: "manual-record-b",
                registeredAt: "2026-04-04T12:00:00.000Z",
              },
            ],
            subtotal: 50,
          },
          {
            currency: "ARS",
            description: "Legacy singular receipt expense",
            id: "legacy-singular-receipt-id",
            occurrencesPerMonth: 1,
            receipt: {
              fileId: "legacy-receipt",
              fileName: "legacy-receipt.pdf",
              fileViewUrl: "https://drive.google.com/legacy-file",
              folderId: "legacy-folder",
              folderViewUrl: "https://drive.google.com/legacy-folder",
            },
            subtotal: 75,
          },
          {
            currency: "ARS",
            description: "Payment record receipt expense",
            id: "payment-record-receipt-id",
            occurrencesPerMonth: 1,
            paymentRecords: [
              {
                coveredPayments: 1,
                id: "receipt-record",
                receipt: {
                  allReceiptsFolderId: "all-receipts-folder-record",
                  allReceiptsFolderViewUrl: "https://drive.google.com/record-a",
                  coveredPayments: 1,
                  fileId: "record-receipt",
                  fileName: "record-receipt.pdf",
                  fileViewUrl: "https://drive.google.com/record-file",
                  monthlyFolderId: "monthly-folder-record",
                  monthlyFolderViewUrl: "https://drive.google.com/record-month",
                },
                registeredAt: "2026-04-05T12:00:00.000Z",
              },
            ],
            subtotal: 25,
          },
        ],
        month: LEGACY_MONTH,
      },
      updatedAtIso: "2026-04-20T10:00:00.000Z",
    });
    await insertLegacyMonthlyExpensesDocument({
      client,
      month: EMPTY_LEGACY_MONTH,
      payload: {
        exchangeRateSnapshot: {
          blueRate: 1210,
          month: EMPTY_LEGACY_MONTH,
          officialRate: 1010,
          solidarityRate: 1310,
        },
        items: [],
        month: EMPTY_LEGACY_MONTH,
      },
      updatedAtIso: "2026-05-20T10:00:00.000Z",
    });

    await client.executeMultiple(readMonthlyExpensesDocumentsMigrationSql());

    const legacyTableRows = await client.execute({
      args: [],
      sql: `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'monthly_expenses_documents'
      `,
    });
    const monthlyDocumentRows = await client.execute({
      args: [USER_SUBJECT],
      sql: `
        SELECT month, exchange_rate_blue_rate AS exchangeRateBlueRate
        FROM monthly_expense_months
        WHERE user_subject = ?
        ORDER BY month
      `,
    });
    const expenseRows = await client.execute({
      args: [USER_SUBJECT],
      sql: `
        SELECT expense_id AS expenseId, description
        FROM expenses
        WHERE user_subject = ?
        ORDER BY expense_id
      `,
    });
    const expenseMonthRows = await client.execute({
      args: [USER_SUBJECT, LEGACY_MONTH],
      sql: `
        SELECT
          expense_id AS expenseId,
          is_paid AS isPaid,
          manual_covered_payments AS manualCoveredPayments,
          month
        FROM expense_months
        WHERE user_subject = ?
          AND month = ?
        ORDER BY expense_id
      `,
    });
    const receiptRows = await client.execute({
      args: [USER_SUBJECT, LEGACY_MONTH],
      sql: `
        SELECT expense_id AS expenseId, file_id AS fileId
        FROM expense_receipts
        WHERE user_subject = ?
          AND month = ?
        ORDER BY file_id
      `,
    });
    const paymentRecordRows = await client.execute({
      args: [USER_SUBJECT, LEGACY_MONTH],
      sql: `
        SELECT
          expense_id AS expenseId,
          payment_record_id AS paymentRecordId,
          receipt_file_id AS receiptFileId
        FROM expense_payment_records
        WHERE user_subject = ?
          AND month = ?
        ORDER BY payment_record_id
      `,
    });

    expect(legacyTableRows.rows).toEqual([]);
    expect(monthlyDocumentRows.rows).toEqual([
      {
        exchangeRateBlueRate: 1200,
        month: LEGACY_MONTH,
      },
      {
        exchangeRateBlueRate: 1210,
        month: EMPTY_LEGACY_MONTH,
      },
    ]);
    expect(expenseRows.rows).toEqual(
      expect.arrayContaining([
        {
          description: "Duplicated expense A",
          expenseId:
            "legacy:user-subject:2026-04:duplicated-expense-id:0",
        },
        {
          description: "Duplicated expense B",
          expenseId:
            "legacy:user-subject:2026-04:duplicated-expense-id:1",
        },
        {
          description: "Legacy singular receipt expense",
          expenseId: "legacy-singular-receipt-id",
        },
        {
          description: "Payment record receipt expense",
          expenseId: "payment-record-receipt-id",
        },
      ]),
    );
    expect(expenseRows.rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expenseId: "stale-expense-id",
        }),
      ]),
    );
    expect(expenseMonthRows.rows).toHaveLength(4);
    expect(expenseMonthRows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expenseId:
            "legacy:user-subject:2026-04:duplicated-expense-id:0",
          isPaid: 1,
          manualCoveredPayments: 1,
        }),
      ]),
    );
    expect(receiptRows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileId: "legacy-receipt",
        }),
        expect.objectContaining({
          fileId: "receipt-a",
        }),
        expect.objectContaining({
          fileId: "record-receipt",
        }),
      ]),
    );
    expect(paymentRecordRows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentRecordId: "legacy-manual-legacy:user-subject:2026-04:duplicated-expense-id:0",
        }),
        expect.objectContaining({
          paymentRecordId: "legacy-receipt-legacy-receipt",
          receiptFileId: "legacy-receipt",
        }),
        expect.objectContaining({
          paymentRecordId: "manual-record-b",
          receiptFileId: null,
        }),
        expect.objectContaining({
          paymentRecordId: "receipt-record",
          receiptFileId: "record-receipt",
        }),
      ]),
    );
  });
});
