import { and, asc, eq, inArray } from "drizzle-orm";

import {
  expenseMonthsTable,
  expensePaymentRecordsTable,
  expenseReceiptsTable,
  expensesTable,
  monthlyExpenseExcludedLoansTable,
  monthlyExpenseMonthsTable,
} from "@/modules/shared/infrastructure/database/drizzle/schema";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import type { StoredMonthlyExpensesDocument } from "../../../domain/entities/stored-monthly-expenses-document";
import type { MonthlyExpensesRepository } from "../../../domain/repositories/monthly-expenses-repository";
import {
  createMonthlyExpensesDocument,
  type MonthlyExpenseItem,
  type MonthlyExpensesExchangeRateSnapshot,
  type MonthlyExpensesDocument,
} from "../../../domain/value-objects/monthly-expenses-document";
import {
  createMonthlyExpensesFileName,
} from "../../google-drive/dto/mapper";

/**
 * Upper bound of monthly documents reconstructed concurrently in {@link
 * DrizzleMonthlyExpensesRepository.listAll}. Each reconstruction issues several
 * queries, so this caps the in-flight request fan-out for long histories while
 * still overlapping round-trips.
 */
const MAX_CONCURRENT_MONTH_RECONSTRUCTIONS = 8;

interface NormalizedExpenseRow {
  allReceiptsFolderId: string | null;
  allReceiptsFolderViewUrl: string | null;
  currency: string;
  description: string;
  exchangeRateBlueRate: number | null;
  exchangeRateMonth: string | null;
  exchangeRateOfficialRate: number | null;
  exchangeRateSolidarityRate: number | null;
  expenseFolderId: string | null;
  expenseId: string;
  isPaid: number;
  loanDirection: string | null;
  loanInstallmentCount: number | null;
  loanLenderId: string | null;
  loanLenderName: string | null;
  loanStartMonth: string | null;
  manualCoveredPayments: number;
  month: string;
  monthlyFolderId: string | null;
  monthlyFolderViewUrl: string | null;
  occurrencesPerMonth: number;
  occurrencesUnit: string | null;
  paymentLink: string | null;
  receiptShareMessage: string | null;
  receiptSharePhoneDigits: string | null;
  requiresReceiptShare: number;
  sortOrder: number | null;
  subtotal: number;
  subtotalUnit: string | null;
}

interface MonthlyExpenseMonthRow {
  exchangeRateBlueRate: number | null;
  exchangeRateMonth: string | null;
  exchangeRateOfficialRate: number | null;
  exchangeRateSolidarityRate: number | null;
  hasReplicatedFromPreviousMonth: number;
  month: string;
}

function toBooleanInteger(value: boolean): number {
  return value ? 1 : 0;
}

function getDuplicatedExpenseIds(items: readonly MonthlyExpenseItem[]): string[] {
  const seenExpenseIds = new Set<string>();
  const duplicatedExpenseIds = new Set<string>();

  for (const item of items) {
    if (seenExpenseIds.has(item.id)) {
      duplicatedExpenseIds.add(item.id);
      continue;
    }

    seenExpenseIds.add(item.id);
  }

  return Array.from(duplicatedExpenseIds);
}

interface MonthlyExpensesPersistenceExecutor {
  delete: TursoDatabase["delete"];
  insert: TursoDatabase["insert"];
  select: TursoDatabase["select"];
}

function buildOrderedCreatedAtIso(baseTimestamp: number, index: number): string {
  return new Date(baseTimestamp + index).toISOString();
}

function assertUniqueExpenseIds(items: readonly MonthlyExpenseItem[]): void {
  const duplicatedExpenseIds = getDuplicatedExpenseIds(items);

  if (duplicatedExpenseIds.length === 0) {
    return;
  }

  throw new Error(
    "Saving monthly expenses requires unique expense ids before persisting SQL rows.",
  );
}

function getExchangeRateSnapshotFromRow(
  row: MonthlyExpenseMonthRow | NormalizedExpenseRow | undefined,
): MonthlyExpensesExchangeRateSnapshot | undefined {
  if (
    !row ||
    row.exchangeRateBlueRate === null ||
    row.exchangeRateMonth === null ||
    row.exchangeRateOfficialRate === null ||
    row.exchangeRateSolidarityRate === null
  ) {
    return undefined;
  }

  return {
    blueRate: row.exchangeRateBlueRate,
    month: row.exchangeRateMonth,
    officialRate: row.exchangeRateOfficialRate,
    solidarityRate: row.exchangeRateSolidarityRate,
  };
}

function getPreferredAllReceiptsFolder(item: MonthlyExpenseItem): {
  id: string | null;
  viewUrl: string | null;
} {
  const folderIdFromFolders = item.folders?.allReceiptsFolderId?.trim() ?? "";
  const folderViewUrlFromFolders = item.folders?.allReceiptsFolderViewUrl?.trim() ?? "";

  if (folderIdFromFolders && folderViewUrlFromFolders) {
    return {
      id: folderIdFromFolders,
      viewUrl: folderViewUrlFromFolders,
    };
  }

  const firstReceipt = item.receipts[0];

  if (!firstReceipt) {
    return {
      id: null,
      viewUrl: null,
    };
  }

  return {
    id: firstReceipt.allReceiptsFolderId,
    viewUrl: firstReceipt.allReceiptsFolderViewUrl,
  };
}

function getPreferredMonthlyFolder(item: MonthlyExpenseItem): {
  id: string | null;
  viewUrl: string | null;
} {
  const folderIdFromFolders = item.folders?.monthlyFolderId?.trim() ?? "";
  const folderViewUrlFromFolders = item.folders?.monthlyFolderViewUrl?.trim() ?? "";

  if (folderIdFromFolders && folderViewUrlFromFolders) {
    return {
      id: folderIdFromFolders,
      viewUrl: folderViewUrlFromFolders,
    };
  }

  const firstReceipt = item.receipts[0];

  if (!firstReceipt) {
    return {
      id: null,
      viewUrl: null,
    };
  }

  return {
    id: firstReceipt.monthlyFolderId,
    viewUrl: firstReceipt.monthlyFolderViewUrl,
  };
}

export class DrizzleMonthlyExpensesRepository
  implements MonthlyExpensesRepository
{
  constructor(
    private readonly database: TursoDatabase,
    private readonly userSubject: string,
  ) {}

  private async removeOrphanedExpenses(
    databaseExecutor: MonthlyExpensesPersistenceExecutor,
    expenseIds: string[],
  ): Promise<void> {
    for (const expenseId of expenseIds) {
      const rows = await databaseExecutor
        .select({
          month: expenseMonthsTable.month,
        })
        .from(expenseMonthsTable)
        .where(
          and(
            eq(expenseMonthsTable.userSubject, this.userSubject),
            eq(expenseMonthsTable.expenseId, expenseId),
          ),
        )
        .limit(1);

      if (rows.length > 0) {
        continue;
      }

      await databaseExecutor
        .delete(expensesTable)
        .where(
          and(
            eq(expensesTable.userSubject, this.userSubject),
            eq(expensesTable.expenseId, expenseId),
          ),
        );
    }
  }

  private async saveNormalizedDocumentWithExecutor(
    databaseExecutor: MonthlyExpensesPersistenceExecutor,
    document: MonthlyExpensesDocument,
  ): Promise<void> {
    assertUniqueExpenseIds(document.items);
    const nowIso = new Date().toISOString();
    const createdAtBaseTimestamp = Date.now();
    const currentExpenseIds = document.items.map((item) => item.id);

    await databaseExecutor
      .insert(monthlyExpenseMonthsTable)
      .values({
        exchangeRateBlueRate: document.exchangeRateSnapshot?.blueRate ?? null,
        exchangeRateMonth: document.exchangeRateSnapshot?.month ?? null,
        exchangeRateOfficialRate:
          document.exchangeRateSnapshot?.officialRate ?? null,
        exchangeRateSolidarityRate:
          document.exchangeRateSnapshot?.solidarityRate ?? null,
        hasReplicatedFromPreviousMonth: toBooleanInteger(
          document.hasReplicatedFromPreviousMonth === true,
        ),
        month: document.month,
        updatedAtIso: nowIso,
        userSubject: this.userSubject,
      })
      .onConflictDoUpdate({
        set: {
          exchangeRateBlueRate: document.exchangeRateSnapshot?.blueRate ?? null,
          exchangeRateMonth: document.exchangeRateSnapshot?.month ?? null,
          exchangeRateOfficialRate:
            document.exchangeRateSnapshot?.officialRate ?? null,
          exchangeRateSolidarityRate:
            document.exchangeRateSnapshot?.solidarityRate ?? null,
          hasReplicatedFromPreviousMonth: toBooleanInteger(
            document.hasReplicatedFromPreviousMonth === true,
          ),
          updatedAtIso: nowIso,
        },
        target: [
          monthlyExpenseMonthsTable.userSubject,
          monthlyExpenseMonthsTable.month,
        ],
      });

    const existingRowsForMonth = await databaseExecutor
      .select({
        expenseId: expenseMonthsTable.expenseId,
      })
      .from(expenseMonthsTable)
      .where(
        and(
          eq(expenseMonthsTable.userSubject, this.userSubject),
          eq(expenseMonthsTable.month, document.month),
        ),
      );

    const existingExpenseIds = existingRowsForMonth.map((row) => row.expenseId);
    const deletedExpenseIds = existingExpenseIds.filter(
      (expenseId) => !currentExpenseIds.includes(expenseId),
    );

    if (deletedExpenseIds.length > 0) {
      await databaseExecutor
        .delete(expensePaymentRecordsTable)
        .where(
          and(
            eq(expensePaymentRecordsTable.userSubject, this.userSubject),
            eq(expensePaymentRecordsTable.month, document.month),
            inArray(expensePaymentRecordsTable.expenseId, deletedExpenseIds),
          ),
        );

      await databaseExecutor
        .delete(expenseReceiptsTable)
        .where(
          and(
            eq(expenseReceiptsTable.userSubject, this.userSubject),
            eq(expenseReceiptsTable.month, document.month),
            inArray(expenseReceiptsTable.expenseId, deletedExpenseIds),
          ),
        );

      await databaseExecutor
        .delete(expenseMonthsTable)
        .where(
          and(
            eq(expenseMonthsTable.userSubject, this.userSubject),
            eq(expenseMonthsTable.month, document.month),
            inArray(expenseMonthsTable.expenseId, deletedExpenseIds),
          ),
        );

      await this.removeOrphanedExpenses(databaseExecutor, deletedExpenseIds);
    }

    if (currentExpenseIds.length > 0) {
      await databaseExecutor
        .delete(expensePaymentRecordsTable)
        .where(
          and(
            eq(expensePaymentRecordsTable.userSubject, this.userSubject),
            eq(expensePaymentRecordsTable.month, document.month),
            inArray(expensePaymentRecordsTable.expenseId, currentExpenseIds),
          ),
        );

      await databaseExecutor
        .delete(expenseReceiptsTable)
        .where(
          and(
            eq(expenseReceiptsTable.userSubject, this.userSubject),
            eq(expenseReceiptsTable.month, document.month),
            inArray(expenseReceiptsTable.expenseId, currentExpenseIds),
          ),
        );
    }

    for (const [itemIndex, item] of document.items.entries()) {
      const allReceiptsFolder = getPreferredAllReceiptsFolder(item);
      const monthlyFolder = getPreferredMonthlyFolder(item);
      const createdAtIso = buildOrderedCreatedAtIso(
        createdAtBaseTimestamp,
        itemIndex,
      );

      await databaseExecutor
        .insert(expensesTable)
        .values({
          allReceiptsFolderId: allReceiptsFolder.id,
          allReceiptsFolderViewUrl: allReceiptsFolder.viewUrl,
          createdAtIso,
          currency: item.currency,
          description: item.description,
          expenseFolderId: item.expenseFolderId ?? null,
          expenseId: item.id,
          loanDirection: item.loan?.direction ?? "payable",
          loanInstallmentCount: item.loan?.installmentCount ?? null,
          loanLenderId: item.loan?.lenderId ?? null,
          loanLenderName: item.loan?.lenderName ?? null,
          loanStartMonth: item.loan?.startMonth ?? null,
          paymentLink: item.paymentLink ?? null,
          receiptShareMessage: item.receiptShareMessage ?? null,
          receiptSharePhoneDigits: item.receiptSharePhoneDigits ?? null,
          requiresReceiptShare: toBooleanInteger(item.requiresReceiptShare === true),
          sortOrder: item.sortOrder ?? itemIndex,
          updatedAtIso: nowIso,
          userSubject: this.userSubject,
        })
        .onConflictDoUpdate({
          set: {
            allReceiptsFolderId: allReceiptsFolder.id,
            allReceiptsFolderViewUrl: allReceiptsFolder.viewUrl,
            currency: item.currency,
            description: item.description,
            expenseFolderId: item.expenseFolderId ?? null,
            loanDirection: item.loan?.direction ?? "payable",
            loanInstallmentCount: item.loan?.installmentCount ?? null,
            loanLenderId: item.loan?.lenderId ?? null,
            loanLenderName: item.loan?.lenderName ?? null,
            loanStartMonth: item.loan?.startMonth ?? null,
            paymentLink: item.paymentLink ?? null,
            receiptShareMessage: item.receiptShareMessage ?? null,
            receiptSharePhoneDigits: item.receiptSharePhoneDigits ?? null,
            requiresReceiptShare: toBooleanInteger(item.requiresReceiptShare === true),
            sortOrder: item.sortOrder ?? itemIndex,
            updatedAtIso: nowIso,
          },
          target: [expensesTable.userSubject, expensesTable.expenseId],
        });

      await databaseExecutor
        .insert(expenseMonthsTable)
        .values({
          exchangeRateBlueRate: document.exchangeRateSnapshot?.blueRate ?? null,
          exchangeRateMonth: document.exchangeRateSnapshot?.month ?? null,
          exchangeRateOfficialRate:
            document.exchangeRateSnapshot?.officialRate ?? null,
          exchangeRateSolidarityRate:
            document.exchangeRateSnapshot?.solidarityRate ?? null,
          expenseId: item.id,
          isPaid: toBooleanInteger(item.isPaid === true),
          manualCoveredPayments: item.manualCoveredPayments,
          month: document.month,
          monthlyFolderId: monthlyFolder.id,
          monthlyFolderViewUrl: monthlyFolder.viewUrl,
          occurrencesPerMonth: item.occurrencesPerMonth,
          occurrencesUnit: item.occurrencesUnit ?? null,
          subtotal: item.subtotal,
          subtotalUnit: item.subtotalUnit === "hour" ? "hour" : null,
          updatedAtIso: nowIso,
          userSubject: this.userSubject,
        })
        .onConflictDoUpdate({
          set: {
            exchangeRateBlueRate: document.exchangeRateSnapshot?.blueRate ?? null,
            exchangeRateMonth: document.exchangeRateSnapshot?.month ?? null,
            exchangeRateOfficialRate:
              document.exchangeRateSnapshot?.officialRate ?? null,
            exchangeRateSolidarityRate:
              document.exchangeRateSnapshot?.solidarityRate ?? null,
            isPaid: toBooleanInteger(item.isPaid === true),
            manualCoveredPayments: item.manualCoveredPayments,
            monthlyFolderId: monthlyFolder.id,
            monthlyFolderViewUrl: monthlyFolder.viewUrl,
            occurrencesPerMonth: item.occurrencesPerMonth,
            occurrencesUnit: item.occurrencesUnit ?? null,
            subtotal: item.subtotal,
            subtotalUnit: item.subtotalUnit === "hour" ? "hour" : null,
            updatedAtIso: nowIso,
          },
          target: [
            expenseMonthsTable.userSubject,
            expenseMonthsTable.expenseId,
            expenseMonthsTable.month,
          ],
        });

      if (item.receipts.length > 0) {
        await databaseExecutor.insert(expenseReceiptsTable).values(
          item.receipts.map((receipt) => ({
            allReceiptsFolderId: receipt.allReceiptsFolderId,
            allReceiptsFolderViewUrl: receipt.allReceiptsFolderViewUrl,
            coveredPayments: receipt.coveredPayments ?? 1,
            expenseId: item.id,
            fileId: receipt.fileId,
            fileName: receipt.fileName,
            fileViewUrl: receipt.fileViewUrl,
            month: document.month,
            monthlyFolderId: receipt.monthlyFolderId,
            monthlyFolderViewUrl: receipt.monthlyFolderViewUrl,
            registeredAtIso: receipt.registeredAt ?? null,
            userSubject: this.userSubject,
          })),
        );
      }

      if (item.paymentRecords && item.paymentRecords.length > 0) {
        await databaseExecutor.insert(expensePaymentRecordsTable).values(
          item.paymentRecords.map((paymentRecord) => ({
            coveredPayments: paymentRecord.coveredPayments,
            expenseId: item.id,
            month: document.month,
            paymentRecordId: paymentRecord.id,
            receiptFileId: paymentRecord.receipt?.fileId ?? null,
            registeredAtIso: paymentRecord.registeredAt ?? null,
            sendStatus: paymentRecord.sendStatus ?? null,
            userSubject: this.userSubject,
          })),
        );
      }
    }

    await this.replaceExcludedLoansWithExecutor(databaseExecutor, document, nowIso);
  }

  /**
   * Replaces the month's excluded-loan rows with the document's current set, so a
   * loan the user removed stays excluded and a re-added loan stops being excluded.
   *
   * @param databaseExecutor - Active transactional executor.
   * @param document - Document whose excluded loan ids are persisted.
   * @param nowIso - Timestamp recorded on each exclusion row.
   */
  private async replaceExcludedLoansWithExecutor(
    databaseExecutor: MonthlyExpensesPersistenceExecutor,
    document: MonthlyExpensesDocument,
    nowIso: string,
  ): Promise<void> {
    await databaseExecutor
      .delete(monthlyExpenseExcludedLoansTable)
      .where(
        and(
          eq(monthlyExpenseExcludedLoansTable.userSubject, this.userSubject),
          eq(monthlyExpenseExcludedLoansTable.month, document.month),
        ),
      );

    const excludedLoanIds = document.excludedLoanIds ?? [];

    if (excludedLoanIds.length === 0) {
      return;
    }

    await databaseExecutor.insert(monthlyExpenseExcludedLoansTable).values(
      excludedLoanIds.map((expenseId) => ({
        expenseId,
        month: document.month,
        updatedAtIso: nowIso,
        userSubject: this.userSubject,
      })),
    );
  }

  private async clearNormalizedMonthWithExecutor(
    databaseExecutor: MonthlyExpensesPersistenceExecutor,
    month: string,
  ): Promise<void> {
    await databaseExecutor
      .delete(monthlyExpenseExcludedLoansTable)
      .where(
        and(
          eq(monthlyExpenseExcludedLoansTable.userSubject, this.userSubject),
          eq(monthlyExpenseExcludedLoansTable.month, month),
        ),
      );

    const existingRowsForMonth = await databaseExecutor
      .select({
        expenseId: expenseMonthsTable.expenseId,
      })
      .from(expenseMonthsTable)
      .where(
        and(
          eq(expenseMonthsTable.userSubject, this.userSubject),
          eq(expenseMonthsTable.month, month),
        ),
      );
    const existingExpenseIds = existingRowsForMonth.map((row) => row.expenseId);

    if (existingExpenseIds.length === 0) {
      return;
    }

    await databaseExecutor
      .delete(expensePaymentRecordsTable)
      .where(
        and(
          eq(expensePaymentRecordsTable.userSubject, this.userSubject),
          eq(expensePaymentRecordsTable.month, month),
          inArray(expensePaymentRecordsTable.expenseId, existingExpenseIds),
        ),
      );

    await databaseExecutor
      .delete(expenseReceiptsTable)
      .where(
        and(
          eq(expenseReceiptsTable.userSubject, this.userSubject),
          eq(expenseReceiptsTable.month, month),
          inArray(expenseReceiptsTable.expenseId, existingExpenseIds),
        ),
      );

    await databaseExecutor
      .delete(expenseMonthsTable)
      .where(
        and(
          eq(expenseMonthsTable.userSubject, this.userSubject),
          eq(expenseMonthsTable.month, month),
          inArray(expenseMonthsTable.expenseId, existingExpenseIds),
        ),
      );

    await this.removeOrphanedExpenses(databaseExecutor, existingExpenseIds);
  }

  private async getByMonthFromNormalized(
    month: string,
  ): Promise<MonthlyExpensesDocument | null> {
    const monthlyRows = await this.database
      .select({
        exchangeRateBlueRate: monthlyExpenseMonthsTable.exchangeRateBlueRate,
        exchangeRateMonth: monthlyExpenseMonthsTable.exchangeRateMonth,
        exchangeRateOfficialRate:
          monthlyExpenseMonthsTable.exchangeRateOfficialRate,
        exchangeRateSolidarityRate:
          monthlyExpenseMonthsTable.exchangeRateSolidarityRate,
        hasReplicatedFromPreviousMonth:
          monthlyExpenseMonthsTable.hasReplicatedFromPreviousMonth,
        month: monthlyExpenseMonthsTable.month,
      })
      .from(monthlyExpenseMonthsTable)
      .where(
        and(
          eq(monthlyExpenseMonthsTable.userSubject, this.userSubject),
          eq(monthlyExpenseMonthsTable.month, month),
        ),
      )
      .limit(1);
    const monthlyRow = monthlyRows[0] as MonthlyExpenseMonthRow | undefined;
    const excludedLoanIds = await this.listExcludedLoanIds(month);
    const rows = await this.database
      .select({
        allReceiptsFolderId: expensesTable.allReceiptsFolderId,
        allReceiptsFolderViewUrl: expensesTable.allReceiptsFolderViewUrl,
        currency: expensesTable.currency,
        description: expensesTable.description,
        exchangeRateBlueRate: expenseMonthsTable.exchangeRateBlueRate,
        exchangeRateMonth: expenseMonthsTable.exchangeRateMonth,
        exchangeRateOfficialRate: expenseMonthsTable.exchangeRateOfficialRate,
        exchangeRateSolidarityRate: expenseMonthsTable.exchangeRateSolidarityRate,
        expenseFolderId: expensesTable.expenseFolderId,
        expenseId: expenseMonthsTable.expenseId,
        isPaid: expenseMonthsTable.isPaid,
        loanDirection: expensesTable.loanDirection,
        loanInstallmentCount: expensesTable.loanInstallmentCount,
        loanLenderId: expensesTable.loanLenderId,
        loanLenderName: expensesTable.loanLenderName,
        loanStartMonth: expensesTable.loanStartMonth,
        manualCoveredPayments: expenseMonthsTable.manualCoveredPayments,
        month: expenseMonthsTable.month,
        monthlyFolderId: expenseMonthsTable.monthlyFolderId,
        monthlyFolderViewUrl: expenseMonthsTable.monthlyFolderViewUrl,
        occurrencesPerMonth: expenseMonthsTable.occurrencesPerMonth,
        occurrencesUnit: expenseMonthsTable.occurrencesUnit,
        paymentLink: expensesTable.paymentLink,
        receiptShareMessage: expensesTable.receiptShareMessage,
        receiptSharePhoneDigits: expensesTable.receiptSharePhoneDigits,
        requiresReceiptShare: expensesTable.requiresReceiptShare,
        sortOrder: expensesTable.sortOrder,
        subtotal: expenseMonthsTable.subtotal,
        subtotalUnit: expenseMonthsTable.subtotalUnit,
      })
      .from(expenseMonthsTable)
      .innerJoin(
        expensesTable,
        and(
          eq(expenseMonthsTable.userSubject, expensesTable.userSubject),
          eq(expenseMonthsTable.expenseId, expensesTable.expenseId),
        ),
      )
      .where(
        and(
          eq(expenseMonthsTable.userSubject, this.userSubject),
          eq(expenseMonthsTable.month, month),
        ),
      )
      .orderBy(
        asc(expensesTable.createdAtIso),
        asc(expenseMonthsTable.expenseId),
      );

    if (rows.length === 0) {
      if (!monthlyRow && excludedLoanIds.length === 0) {
        return null;
      }

      const emptyMonthExchangeRateSnapshot = monthlyRow
        ? getExchangeRateSnapshotFromRow(monthlyRow)
        : null;

      return createMonthlyExpensesDocument(
        {
          ...(excludedLoanIds.length > 0 ? { excludedLoanIds } : {}),
          ...(emptyMonthExchangeRateSnapshot
            ? { exchangeRateSnapshot: emptyMonthExchangeRateSnapshot }
            : {}),
          hasReplicatedFromPreviousMonth:
            monthlyRow?.hasReplicatedFromPreviousMonth === 1,
          items: [],
          month,
        },
        "Loading monthly expenses from database",
      );
    }

    const normalizedRows = rows as NormalizedExpenseRow[];
    const expenseIds = normalizedRows.map((row) => row.expenseId);

    const receiptRows = expenseIds.length > 0
      ? await this.database
          .select({
            allReceiptsFolderId: expenseReceiptsTable.allReceiptsFolderId,
            allReceiptsFolderViewUrl: expenseReceiptsTable.allReceiptsFolderViewUrl,
            coveredPayments: expenseReceiptsTable.coveredPayments,
            expenseId: expenseReceiptsTable.expenseId,
            fileId: expenseReceiptsTable.fileId,
            fileName: expenseReceiptsTable.fileName,
            fileViewUrl: expenseReceiptsTable.fileViewUrl,
            monthlyFolderId: expenseReceiptsTable.monthlyFolderId,
            monthlyFolderViewUrl: expenseReceiptsTable.monthlyFolderViewUrl,
            registeredAtIso: expenseReceiptsTable.registeredAtIso,
          })
          .from(expenseReceiptsTable)
          .where(
            and(
              eq(expenseReceiptsTable.userSubject, this.userSubject),
              eq(expenseReceiptsTable.month, month),
              inArray(expenseReceiptsTable.expenseId, expenseIds),
            ),
          )
      : [];

    const paymentRecordRows = expenseIds.length > 0
      ? await this.database
          .select({
            coveredPayments: expensePaymentRecordsTable.coveredPayments,
            expenseId: expensePaymentRecordsTable.expenseId,
            paymentRecordId: expensePaymentRecordsTable.paymentRecordId,
            receiptFileId: expensePaymentRecordsTable.receiptFileId,
            registeredAtIso: expensePaymentRecordsTable.registeredAtIso,
            sendStatus: expensePaymentRecordsTable.sendStatus,
          })
          .from(expensePaymentRecordsTable)
          .where(
            and(
              eq(expensePaymentRecordsTable.userSubject, this.userSubject),
              eq(expensePaymentRecordsTable.month, month),
              inArray(expensePaymentRecordsTable.expenseId, expenseIds),
            ),
          )
      : [];

    const receiptsByExpenseId = new Map<
      string,
      {
        allReceiptsFolderId: string;
        allReceiptsFolderViewUrl: string;
        coveredPayments: number;
        fileId: string;
        fileName: string;
        fileViewUrl: string;
        monthlyFolderId: string;
        monthlyFolderViewUrl: string;
        registeredAt?: string | null;
      }[]
    >();
    const receiptsByExpenseAndFileId = new Map<string, {
      allReceiptsFolderId: string;
      allReceiptsFolderViewUrl: string;
      coveredPayments: number;
      fileId: string;
      fileName: string;
      fileViewUrl: string;
      monthlyFolderId: string;
      monthlyFolderViewUrl: string;
      registeredAt?: string | null;
    }>();

    for (const receipt of receiptRows) {
      const receiptForDocument = {
        allReceiptsFolderId: receipt.allReceiptsFolderId,
        allReceiptsFolderViewUrl: receipt.allReceiptsFolderViewUrl,
        coveredPayments: receipt.coveredPayments,
        fileId: receipt.fileId,
        fileName: receipt.fileName,
        fileViewUrl: receipt.fileViewUrl,
        monthlyFolderId: receipt.monthlyFolderId,
        monthlyFolderViewUrl: receipt.monthlyFolderViewUrl,
        ...(receipt.registeredAtIso ? { registeredAt: receipt.registeredAtIso } : {}),
      };
      const existingReceipts = receiptsByExpenseId.get(receipt.expenseId) ?? [];
      existingReceipts.push(receiptForDocument);
      receiptsByExpenseId.set(receipt.expenseId, existingReceipts);
      receiptsByExpenseAndFileId.set(
        `${receipt.expenseId}:${receipt.fileId}`,
        receiptForDocument,
      );
    }

    const paymentRecordsByExpenseId = new Map<
      string,
      {
        coveredPayments: number;
        id: string;
        receipt?: {
          allReceiptsFolderId: string;
          allReceiptsFolderViewUrl: string;
          coveredPayments: number;
          fileId: string;
          fileName: string;
          fileViewUrl: string;
          monthlyFolderId: string;
          monthlyFolderViewUrl: string;
          registeredAt?: string | null;
        };
        registeredAt?: string | null;
        sendStatus?: "pending" | "sent" | null;
      }[]
    >();

    for (const paymentRecord of paymentRecordRows) {
      const resolvedReceipt = paymentRecord.receiptFileId
        ? receiptsByExpenseAndFileId.get(
            `${paymentRecord.expenseId}:${paymentRecord.receiptFileId}`,
          )
        : undefined;
      const paymentRecordForDocument = {
        coveredPayments: paymentRecord.coveredPayments,
        id: paymentRecord.paymentRecordId,
        ...(resolvedReceipt ? { receipt: resolvedReceipt } : {}),
        ...(paymentRecord.registeredAtIso
          ? { registeredAt: paymentRecord.registeredAtIso }
          : {}),
        ...(paymentRecord.sendStatus
          ? { sendStatus: paymentRecord.sendStatus as "pending" | "sent" }
          : {}),
      };
      const existingPaymentRecords =
        paymentRecordsByExpenseId.get(paymentRecord.expenseId) ?? [];
      existingPaymentRecords.push(paymentRecordForDocument);
      paymentRecordsByExpenseId.set(
        paymentRecord.expenseId,
        existingPaymentRecords,
      );
    }

    const firstRow = normalizedRows[0];
    const exchangeRateSnapshot =
      getExchangeRateSnapshotFromRow(monthlyRow) ??
      getExchangeRateSnapshotFromRow(firstRow);

    return createMonthlyExpensesDocument(
      {
        ...(excludedLoanIds.length > 0 ? { excludedLoanIds } : {}),
        ...(exchangeRateSnapshot
          ? {
              exchangeRateSnapshot,
            }
          : {}),
        ...(monthlyRow
          ? {
              hasReplicatedFromPreviousMonth:
                monthlyRow.hasReplicatedFromPreviousMonth === 1,
            }
          : {}),
        items: normalizedRows.map((row) => ({
          currency: row.currency as "ARS" | "USD",
          description: row.description,
          ...(row.expenseFolderId
            ? { expenseFolderId: row.expenseFolderId }
            : {}),
          ...(row.sortOrder !== null ? { sortOrder: row.sortOrder } : {}),
          ...(row.allReceiptsFolderId && row.allReceiptsFolderViewUrl
            ? {
                folders: {
                  allReceiptsFolderId: row.allReceiptsFolderId,
                  allReceiptsFolderViewUrl: row.allReceiptsFolderViewUrl,
                  monthlyFolderId: row.monthlyFolderId ?? "",
                  monthlyFolderViewUrl: row.monthlyFolderViewUrl ?? "",
                },
              }
            : {}),
          id: row.expenseId,
          ...(row.isPaid === 1 ? { isPaid: true } : {}),
          ...(row.loanInstallmentCount && row.loanStartMonth
            ? {
                loan: {
                  direction:
                    row.loanDirection === "receivable"
                      ? "receivable"
                      : "payable",
                  installmentCount: row.loanInstallmentCount,
                  ...(row.loanLenderId ? { lenderId: row.loanLenderId } : {}),
                  ...(row.loanLenderName ? { lenderName: row.loanLenderName } : {}),
                  startMonth: row.loanStartMonth,
                },
              }
            : {}),
          ...(row.manualCoveredPayments > 0
            ? { manualCoveredPayments: row.manualCoveredPayments }
            : {}),
          occurrencesPerMonth: row.occurrencesPerMonth,
          ...(row.occurrencesUnit
            ? { occurrencesUnit: row.occurrencesUnit }
            : {}),
          ...(paymentRecordsByExpenseId.has(row.expenseId)
            ? {
                paymentRecords:
                  paymentRecordsByExpenseId.get(row.expenseId),
              }
            : {}),
          ...(row.paymentLink ? { paymentLink: row.paymentLink } : {}),
          ...(row.receiptShareMessage
            ? { receiptShareMessage: row.receiptShareMessage }
            : {}),
          ...(row.receiptSharePhoneDigits
            ? { receiptSharePhoneDigits: row.receiptSharePhoneDigits }
            : {}),
          ...(row.requiresReceiptShare === 1 ? { requiresReceiptShare: true } : {}),
          ...(receiptsByExpenseId.has(row.expenseId)
            ? {
                receipts: receiptsByExpenseId.get(row.expenseId),
              }
            : {}),
          subtotal: row.subtotal,
          ...(row.subtotalUnit === "hour"
            ? { subtotalUnit: "hour" as const }
            : {}),
        })),
        month,
      },
      "Loading monthly expenses from database",
    );
  }

  private async listExcludedLoanIds(month: string): Promise<string[]> {
    const rows = await this.database
      .select({
        expenseId: monthlyExpenseExcludedLoansTable.expenseId,
      })
      .from(monthlyExpenseExcludedLoansTable)
      .where(
        and(
          eq(monthlyExpenseExcludedLoansTable.userSubject, this.userSubject),
          eq(monthlyExpenseExcludedLoansTable.month, month),
        ),
      );

    return rows.map((row) => row.expenseId);
  }

  async getByMonth(month: string): Promise<MonthlyExpensesDocument | null> {
    return this.getByMonthFromNormalized(month);
  }

  async getOldestStoredMonth(): Promise<string | null> {
    const rows = await this.database
      .select({
        month: monthlyExpenseMonthsTable.month,
      })
      .from(monthlyExpenseMonthsTable)
      .where(eq(monthlyExpenseMonthsTable.userSubject, this.userSubject))
      .orderBy(asc(monthlyExpenseMonthsTable.month))
      .limit(1);

    return rows[0]?.month ?? null;
  }

  async save(
    document: MonthlyExpensesDocument,
  ): Promise<StoredMonthlyExpensesDocument> {
    assertUniqueExpenseIds(document.items);

    await this.database.transaction(async (transaction) => {
      await this.saveNormalizedDocumentWithExecutor(transaction, document);
    });

    return {
      id: `${this.userSubject}:${document.month}`,
      month: document.month,
      name: createMonthlyExpensesFileName(document.month),
      viewUrl: null,
    };
  }

  async listAll(): Promise<MonthlyExpensesDocument[]> {
    const monthlyRows = await this.database
      .select({
        month: monthlyExpenseMonthsTable.month,
      })
      .from(monthlyExpenseMonthsTable)
      .where(eq(monthlyExpenseMonthsTable.userSubject, this.userSubject));
    const uniqueMonths = Array.from(
      new Set(monthlyRows.map((row) => row.month)),
    ).sort((left, right) => left.localeCompare(right));

    // Each month is reconstructed independently, so fetch them concurrently
    // instead of awaiting one before starting the next. This turns N sequential
    // round-trips to the (remote) database into overlapping batches, which is the
    // dominant cost when building the loans report over a long history.
    //
    // Concurrency is capped: every reconstruction fans out into several queries
    // (month metadata, exclusions, rows, receipts, payment records), so an
    // unbounded fan-out over a long history could hit Turso request limits or
    // time out. A fixed-size worker pool keeps the speed-up while bounding the
    // number of in-flight requests.
    const documents: Array<MonthlyExpensesDocument | null> = new Array(
      uniqueMonths.length,
    ).fill(null);
    let nextMonthIndex = 0;
    const reconstructMonthsFromCursor = async (): Promise<void> => {
      while (nextMonthIndex < uniqueMonths.length) {
        const monthIndex = nextMonthIndex;
        nextMonthIndex += 1;
        documents[monthIndex] = await this.getByMonth(uniqueMonths[monthIndex]);
      }
    };
    const workerCount = Math.min(
      MAX_CONCURRENT_MONTH_RECONSTRUCTIONS,
      uniqueMonths.length,
    );

    await Promise.all(
      Array.from({ length: workerCount }, reconstructMonthsFromCursor),
    );

    return documents.filter(
      (document): document is MonthlyExpensesDocument => document !== null,
    );
  }

  async listMonthsWithExpenses(): Promise<string[]> {
    const monthRows = await this.database
      .select({
        month: expenseMonthsTable.month,
      })
      .from(expenseMonthsTable)
      .where(eq(expenseMonthsTable.userSubject, this.userSubject));

    return Array.from(new Set(monthRows.map((row) => row.month)));
  }

  createFileName(month: string): string {
    return createMonthlyExpensesFileName(month);
  }
}
