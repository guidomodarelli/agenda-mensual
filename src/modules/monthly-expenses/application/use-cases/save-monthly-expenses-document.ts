import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type { MonthlyExpenseReceiptsRepository } from "../../domain/repositories/monthly-expense-receipts-repository";
import {
  createMonthlyExpensesDocument,
  type MonthlyExpensesDocument,
  toMonthlyExpensesDocumentInput,
} from "../../domain/value-objects/monthly-expenses-document";
import type { SaveMonthlyExpensesCommand } from "../commands/save-monthly-expenses-command";
import { MonthlyExpenseCoverageValidationError } from "../errors/monthly-expense-coverage-validation-error";
import {
  type MonthlyExpenseReceiptRenameWarningResult,
  type SaveMonthlyExpensesDocumentResult,
  toStoredMonthlyExpensesDocumentResult,
} from "../results/stored-monthly-expenses-document-result";
import {
  buildMonthlyExpenseReceiptFileName,
  getReceiptFileNameDatePrefix,
} from "./monthly-expense-receipt-file-name";
import { projectMonthlyExpenseLoans } from "./project-monthly-expense-loans";
import type { MonthlyExchangeRateSnapshot } from "@/modules/exchange-rates/domain/entities/monthly-exchange-rate-snapshot";
import {
  MissingMonthlyExchangeRateError,
} from "@/modules/exchange-rates/domain/errors/missing-monthly-exchange-rate-error";

const MONTHLY_EXCHANGE_RATE_FALLBACK_MESSAGE =
  "No pudimos cargar la cotización histórica del mes seleccionado. Igual podés seguir cargando y guardando gastos.";

interface SaveMonthlyExpensesDocumentDependencies {
  command: SaveMonthlyExpensesCommand;
  getExchangeRateSnapshot: (
    month: string,
  ) => Promise<MonthlyExchangeRateSnapshot>;
  now?: Date;
  receiptsRepository?: MonthlyExpenseReceiptsRepository;
  repository: MonthlyExpensesRepository;
}

function validateCoverageConsistency(document: MonthlyExpensesDocument): void {
  for (const item of document.items) {
    const requiredPayments = item.occurrencesPerMonth;
    const manualCoveredPayments = item.manualCoveredPayments ?? 0;
    const coveredPaymentsByReceipts = item.receipts.reduce(
      (coveredPayments, receipt) =>
        coveredPayments + (receipt.coveredPayments ?? 1),
      0,
    );

    if (manualCoveredPayments > requiredPayments) {
      throw new MonthlyExpenseCoverageValidationError(
        "Saving monthly expenses requires manual covered payments to be between 0 and total required payments for each expense.",
      );
    }

    const remainingPaymentsForReceipts = requiredPayments - manualCoveredPayments;

    if (coveredPaymentsByReceipts > remainingPaymentsForReceipts) {
      throw new MonthlyExpenseCoverageValidationError(
        "Saving monthly expenses requires receipt coverage to be less than or equal to the remaining payments for each expense.",
      );
    }
  }
}

async function syncReceiptFolderRenames({
  currentDocument,
  nextDocument,
  receiptsRepository,
}: {
  currentDocument: MonthlyExpensesDocument;
  nextDocument: MonthlyExpensesDocument;
  receiptsRepository: MonthlyExpenseReceiptsRepository;
}): Promise<void> {
  const currentItemsById = new Map(
    currentDocument.items.map((item) => [item.id, item]),
  );

  for (const nextItem of nextDocument.items) {
    const currentItem = currentItemsById.get(nextItem.id);

    if (!currentItem) {
      continue;
    }

    if (currentItem.description === nextItem.description) {
      continue;
    }

    const currentFolderId =
      currentItem.folders?.allReceiptsFolderId?.trim() ||
      currentItem.receipts[0]?.allReceiptsFolderId?.trim();
    const nextFolderId =
      nextItem.folders?.allReceiptsFolderId?.trim() ||
      nextItem.receipts[0]?.allReceiptsFolderId?.trim();
    if (
      !currentFolderId ||
      !nextFolderId ||
      currentFolderId !== nextFolderId
    ) {
      continue;
    }

    await receiptsRepository.renameExpenseFolder({
      folderId: nextFolderId,
      nextDescription: nextItem.description,
    });
  }
}

async function syncReceiptFileRenames({
  currentDocument,
  nextDocument,
  now,
  receiptsRepository,
}: {
  currentDocument: MonthlyExpensesDocument;
  nextDocument: MonthlyExpensesDocument;
  now: Date;
  receiptsRepository: MonthlyExpenseReceiptsRepository;
}): Promise<{
  document: MonthlyExpensesDocument;
  receiptRenameWarnings: MonthlyExpenseReceiptRenameWarningResult[];
  renamedReceiptFilesCount: number;
}> {
  const receiptRenameWarnings: MonthlyExpenseReceiptRenameWarningResult[] = [];
  let renamedReceiptFilesCount = 0;
  const currentItemsById = new Map(
    currentDocument.items.map((item) => [item.id, item]),
  );

  const renamedItems = await Promise.all(
    nextDocument.items.map(async (nextItem) => {
      const currentItem = currentItemsById.get(nextItem.id);

      if (!currentItem || nextItem.receipts.length === 0) {
        return nextItem;
      }

      const isDescriptionChanged = currentItem.description !== nextItem.description;
      const currentReceiptsByFileId = new Map(
        currentItem.receipts.map((receipt) => [receipt.fileId, receipt]),
      );
      const renamedReceipts = await Promise.all(
        nextItem.receipts.map(async (nextReceipt) => {
          const currentReceipt = currentReceiptsByFileId.get(nextReceipt.fileId);

          if (!currentReceipt) {
            return nextReceipt;
          }

          const currentCoveredPayments = currentReceipt.coveredPayments ?? 1;
          const nextCoveredPayments = nextReceipt.coveredPayments ?? 1;

          if (!isDescriptionChanged && currentCoveredPayments === nextCoveredPayments) {
            return nextReceipt;
          }

          const preferredDatePrefix =
            getReceiptFileNameDatePrefix(currentReceipt.fileName) ??
            getReceiptFileNameDatePrefix(nextReceipt.fileName) ??
            undefined;
          const nextFileName = buildMonthlyExpenseReceiptFileName({
            coveredPayments: nextCoveredPayments,
            date: now,
            expenseDescription: nextItem.description,
            originalFileName: currentReceipt.fileName,
            preferredDatePrefix,
          });

          if (nextFileName === currentReceipt.fileName) {
            return {
              ...nextReceipt,
              fileName: nextFileName,
            };
          }

          try {
            await receiptsRepository.renameReceiptFile({
              fileId: nextReceipt.fileId,
              nextFileName,
            });
            renamedReceiptFilesCount += 1;
          } catch (error) {
            const reasonCode =
              typeof error === "object" &&
              error &&
              "code" in error &&
              (error.code === "not_found" ||
                error.code === "invalid_payload" ||
                error.code === "insufficient_permissions")
                ? error.code
                : "unexpected";

            receiptRenameWarnings.push({
              fileId: nextReceipt.fileId,
              nextFileName,
              previousFileName: currentReceipt.fileName,
              reasonCode,
            });

            return {
              ...nextReceipt,
              fileName: currentReceipt.fileName,
            };
          }

          return {
            ...nextReceipt,
            fileName: nextFileName,
          };
        }),
      );

      return {
        ...nextItem,
        receipts: renamedReceipts,
      };
    }),
  );

  return {
    document: {
      ...nextDocument,
      items: renamedItems,
    },
    receiptRenameWarnings,
    renamedReceiptFilesCount,
  };
}

/**
 * Resolves the loans the user intentionally removed from the month: every loan
 * whose installment range covers the month (its canonical definition lives in some
 * stored document) yet is absent from the items being saved. Persisting them as
 * exclusions keeps loan projection from re-adding the deleted installment on the
 * next load.
 *
 * @param month - Month being saved (`YYYY-MM`).
 * @param repository - Repository used to scan every stored document for loans.
 * @param savedItems - The items the user is keeping in the month.
 * @returns The excluded loan ids for the month.
 */
async function resolveExcludedLoanIds({
  month,
  repository,
  savedItems,
}: {
  month: string;
  repository: MonthlyExpensesRepository;
  savedItems: MonthlyExpensesDocument["items"];
}): Promise<string[]> {
  const documents =
    typeof repository.listAll === "function"
      ? (await repository.listAll()) ?? []
      : [];
  const savedItemIds = new Set(savedItems.map((item) => item.id));

  return projectMonthlyExpenseLoans({
    baseItems: savedItems,
    documents,
    excludedLoanIds: [],
    targetMonth: month,
  })
    .map((item) => item.id)
    .filter((id) => !savedItemIds.has(id));
}

export async function saveMonthlyExpensesDocument({
  command,
  getExchangeRateSnapshot,
  now = new Date(),
  receiptsRepository,
  repository,
}: SaveMonthlyExpensesDocumentDependencies): Promise<SaveMonthlyExpensesDocumentResult> {
  const validatedBaseDocument: MonthlyExpensesDocument = createMonthlyExpensesDocument(
    command,
    "Saving monthly expenses",
  );
  let exchangeRateSnapshot: MonthlyExchangeRateSnapshot | null = null;
  let exchangeRateLoadError: string | null = null;

  try {
    exchangeRateSnapshot = await getExchangeRateSnapshot(
      validatedBaseDocument.month,
    );
  } catch (error) {
    if (!(error instanceof MissingMonthlyExchangeRateError)) {
      throw error;
    }

    exchangeRateLoadError = MONTHLY_EXCHANGE_RATE_FALLBACK_MESSAGE;
  }
  const currentDocument = await repository.getByMonth(validatedBaseDocument.month);
  const hasReplicatedFromPreviousMonth =
    command.hasReplicatedFromPreviousMonth ??
    currentDocument?.hasReplicatedFromPreviousMonth ??
    false;
  const resolvedExchangeRateSnapshot =
    exchangeRateSnapshot ?? currentDocument?.exchangeRateSnapshot ?? null;
  const excludedLoanIds = await resolveExcludedLoanIds({
    month: validatedBaseDocument.month,
    repository,
    savedItems: validatedBaseDocument.items,
  });
  const validatedDocumentInput = {
    ...toMonthlyExpensesDocumentInput(validatedBaseDocument),
    ...(excludedLoanIds.length > 0 ? { excludedLoanIds } : {}),
    ...(hasReplicatedFromPreviousMonth
      ? { hasReplicatedFromPreviousMonth: true }
      : {}),
    ...(resolvedExchangeRateSnapshot
      ? {
          exchangeRateSnapshot: {
            blueRate: resolvedExchangeRateSnapshot.blueRate,
            month: resolvedExchangeRateSnapshot.month,
            officialRate: resolvedExchangeRateSnapshot.officialRate,
            solidarityRate: resolvedExchangeRateSnapshot.solidarityRate,
          },
        }
      : {}),
  };
  const validatedDocument: MonthlyExpensesDocument = createMonthlyExpensesDocument(
    validatedDocumentInput,
    "Saving monthly expenses",
  );

  validateCoverageConsistency(validatedDocument);

  let documentToSave = validatedDocument;
  let receiptRenameWarnings: MonthlyExpenseReceiptRenameWarningResult[] = [];
  let renamedReceiptFilesCount = 0;

  if (currentDocument && receiptsRepository) {
    await syncReceiptFolderRenames({
      currentDocument,
      nextDocument: documentToSave,
      receiptsRepository,
    });

    const receiptFileRenameResult = await syncReceiptFileRenames({
      currentDocument,
      nextDocument: documentToSave,
      now,
      receiptsRepository,
    });
    documentToSave = receiptFileRenameResult.document;
    receiptRenameWarnings = receiptFileRenameResult.receiptRenameWarnings;
    renamedReceiptFilesCount = receiptFileRenameResult.renamedReceiptFilesCount;
  }

  return {
    ...(exchangeRateLoadError ? { exchangeRateLoadError } : {}),
    receiptRenameWarnings,
    renamedReceiptFilesCount,
    storedDocument: toStoredMonthlyExpensesDocumentResult(
      await repository.save(documentToSave),
    ),
  };
}
