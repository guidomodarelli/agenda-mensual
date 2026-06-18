import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type {
  MonthlyExpenseReceiptsRepository,
} from "../../domain/repositories/monthly-expense-receipts-repository";
import {
  createEmptyMonthlyExpensesDocument,
  createMonthlyExpensesDocument,
  toMonthlyExpensesDocumentInput,
  type MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import type { GetMonthlyExpensesDocumentQuery } from "../queries/get-monthly-expenses-document-query";
import {
  getOutOfRangeStoredLoanIds,
  projectMonthlyExpenseLoans,
} from "./project-monthly-expense-loans";
import {
  toMonthlyExpensesDocumentResult,
  type MonthlyExpensesDocumentResult,
} from "../results/monthly-expenses-document-result";
import type { MonthlyExchangeRateSnapshot } from "@/modules/exchange-rates/domain/entities/monthly-exchange-rate-snapshot";
import {
  MissingMonthlyExchangeRateError,
} from "@/modules/exchange-rates/domain/errors/missing-monthly-exchange-rate-error";

const MONTHLY_EXCHANGE_RATE_FALLBACK_MESSAGE =
  "No pudimos cargar la cotización histórica del mes seleccionado. Igual podés seguir cargando y guardando gastos.";

interface GetMonthlyExpensesDocumentDependencies {
  getExchangeRateSnapshot: (
    month: string,
  ) => Promise<MonthlyExchangeRateSnapshot>;
  /**
   * Invoked when loading the month persists a previously missing exchange-rate
   * snapshot (a write that happens on the read path for older months). Callers
   * running in a request that may serve cached derived data (e.g. the loans
   * report) use this to invalidate that cache. Optional: SSR and read-only
   * callers omit it.
   */
  onExchangeRateSnapshotPersisted?: () => void | Promise<void>;
  query: GetMonthlyExpensesDocumentQuery;
  receiptsRepository?: MonthlyExpenseReceiptsRepository;
  repository: MonthlyExpensesRepository;
}

function getPreferredFolderId(
  primaryFolderId: string | undefined,
  fallbackFolderId: string | undefined,
): string | undefined {
  if (primaryFolderId !== undefined) {
    return primaryFolderId;
  }

  return fallbackFolderId;
}

async function verifyReceiptStatusesByFileId({
  document,
  includeDriveStatuses,
  receiptsRepository,
}: {
  document: ReturnType<typeof createMonthlyExpensesDocument>;
  includeDriveStatuses: boolean;
  receiptsRepository?: MonthlyExpenseReceiptsRepository;
}) {
  if (!includeDriveStatuses || !receiptsRepository) {
    return {};
  }

  const statusesByFileId: Record<
    string,
    {
      allReceiptsFolderStatus: "normal" | "trashed" | "missing";
      fileStatus: "normal" | "trashed" | "missing";
      monthlyFolderStatus?: "normal" | "trashed" | "missing";
    }
  > = {};

  for (const item of document.items) {
    for (const receipt of item.receipts) {
      try {
        statusesByFileId[receipt.fileId] = await receiptsRepository.verifyReceipt({
          allReceiptsFolderId: receipt.allReceiptsFolderId,
          fileId: receipt.fileId,
          monthlyFolderId: receipt.monthlyFolderId,
        });
      } catch {
        // Keep document loading resilient even if Drive status verification fails.
      }
    }
  }

  return statusesByFileId;
}

async function verifyFolderStatusesByItemId({
  document,
  includeDriveStatuses,
  receiptsRepository,
}: {
  document: ReturnType<typeof createMonthlyExpensesDocument>;
  includeDriveStatuses: boolean;
  receiptsRepository?: MonthlyExpenseReceiptsRepository;
}) {
  if (!includeDriveStatuses || !receiptsRepository) {
    return {};
  }

  const statusesByItemId: Record<
    string,
    {
      allReceiptsFolderStatus: "normal" | "trashed" | "missing";
      monthlyFolderStatus?: "normal" | "trashed" | "missing";
    }
  > = {};

  for (const item of document.items) {
    const allReceiptsFolderId = getPreferredFolderId(
      item.folders?.allReceiptsFolderId,
      item.receipts[0]?.allReceiptsFolderId,
    );
    const monthlyFolderId = getPreferredFolderId(
      item.folders?.monthlyFolderId,
      item.receipts[0]?.monthlyFolderId,
    );

    if (!allReceiptsFolderId) {
      continue;
    }

    try {
      statusesByItemId[item.id] = await receiptsRepository.verifyFolders({
        allReceiptsFolderId,
        monthlyFolderId: monthlyFolderId ?? "",
      });
    } catch {
      // Keep document loading resilient even if Drive status verification fails.
    }
  }

  return statusesByItemId;
}

/**
 * Augments the month's real document with the loans projected from other months:
 * loans whose range covers the month but that are not physically stored in it are
 * appended, and loans already stored whose canonical (latest) snapshot lives in a
 * newer month get their definition refreshed in place while keeping that month's
 * payment state. The projection is only reflected in the returned document; it is
 * never persisted here, so loans materialize only when the user saves the month.
 *
 * @param realDocument - The month's persisted document (real items only).
 * @param repository - Repository used to scan every stored document for loans.
 * @returns The document including the projected loans, or the same document when
 *   there is nothing to project.
 */
async function projectLoansIntoDocument({
  realDocument,
  repository,
}: {
  realDocument: MonthlyExpensesDocument;
  repository: MonthlyExpensesRepository;
}): Promise<MonthlyExpensesDocument> {
  const documents = (await repository.listAll()) ?? [];
  const projectionInput = {
    baseItems: realDocument.items,
    documents,
    excludedLoanIds: realDocument.excludedLoanIds,
    targetMonth: realDocument.month,
  };
  const projectedLoanItems = projectMonthlyExpenseLoans(projectionInput);
  // Stored loan copies a newer canonical snapshot pushed out of range must be
  // dropped so a no-longer-active installment stops showing and cannot be re-saved.
  const outOfRangeLoanIds = new Set(getOutOfRangeStoredLoanIds(projectionInput));

  if (projectedLoanItems.length === 0 && outOfRangeLoanIds.size === 0) {
    return realDocument;
  }

  const realDocumentInput = toMonthlyExpensesDocumentInput(realDocument);
  const projectedItemsById = new Map(
    projectedLoanItems.map((item) => [item.id, item]),
  );
  // Overlay the canonical definition on stored copies (preserving their per-month
  // payment state, which the projection intentionally omits) so amount/installment
  // changes propagate to months that already contain the loan, and drop copies the
  // canonical range no longer covers.
  const refreshedExistingItems = realDocumentInput.items
    .filter((item) => !outOfRangeLoanIds.has(item.id))
    .map((item) => {
      const projectedItem = projectedItemsById.get(item.id);

      return projectedItem ? { ...item, ...projectedItem } : item;
    });
  const existingItemIds = new Set(
    realDocumentInput.items.map((item) => item.id),
  );
  const newProjectedItems = projectedLoanItems.filter(
    (item) => !existingItemIds.has(item.id),
  );

  return createMonthlyExpensesDocument(
    {
      ...realDocumentInput,
      items: [...refreshedExistingItems, ...newProjectedItems],
    },
    "Loading monthly expenses",
  );
}

export async function getMonthlyExpensesDocument({
  getExchangeRateSnapshot,
  onExchangeRateSnapshotPersisted,
  query,
  receiptsRepository,
  repository,
}: GetMonthlyExpensesDocumentDependencies): Promise<MonthlyExpensesDocumentResult> {
  const includeDriveStatuses = query.includeDriveStatuses !== false;
  const storedDocument = await repository.getByMonth(query.month);

  let realDocument: MonthlyExpensesDocument;
  let exchangeRateLoadError: string | null = null;

  try {
    const exchangeRateSnapshot = await getExchangeRateSnapshot(query.month);

    if (!storedDocument) {
      realDocument = createMonthlyExpensesDocument(
        {
          exchangeRateSnapshot: {
            blueRate: exchangeRateSnapshot.blueRate,
            month: exchangeRateSnapshot.month,
            officialRate: exchangeRateSnapshot.officialRate,
            solidarityRate: exchangeRateSnapshot.solidarityRate,
          },
          items: [],
          month: query.month,
        },
        "Loading monthly expenses",
      );
    } else if (storedDocument.exchangeRateSnapshot) {
      realDocument = storedDocument;
    } else {
      realDocument = createMonthlyExpensesDocument(
        {
          ...toMonthlyExpensesDocumentInput(storedDocument),
          exchangeRateSnapshot: {
            blueRate: exchangeRateSnapshot.blueRate,
            month: exchangeRateSnapshot.month,
            officialRate: exchangeRateSnapshot.officialRate,
            solidarityRate: exchangeRateSnapshot.solidarityRate,
          },
        },
        "Loading monthly expenses",
      );

      await repository.save(realDocument);
      await onExchangeRateSnapshotPersisted?.();
    }
  } catch (error) {
    realDocument =
      storedDocument ?? createEmptyMonthlyExpensesDocument(query.month);
    exchangeRateLoadError =
      error instanceof MissingMonthlyExchangeRateError
        ? MONTHLY_EXCHANGE_RATE_FALLBACK_MESSAGE
        : "No pudimos cargar la cotización histórica del mes seleccionado.";
  }

  const projectedDocument = await projectLoansIntoDocument({
    realDocument,
    repository,
  });

  return toMonthlyExpensesDocumentResult(
    projectedDocument,
    exchangeRateLoadError,
    await verifyReceiptStatusesByFileId({
      document: projectedDocument,
      includeDriveStatuses,
      receiptsRepository,
    }),
    await verifyFolderStatusesByItemId({
      document: projectedDocument,
      includeDriveStatuses,
      receiptsRepository,
    }),
  );
}
