/**
 * Projects loan installments across every month within their active range so a
 * loan added in any month is reflected in the previous, current and following
 * months without manually copying or replicating it.
 *
 * @module projectMonthlyExpenseLoans
 */
import {
  calculateLoanEndMonth,
  type MonthlyExpenseItem,
  type MonthlyExpenseItemInput,
  type MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";

interface ProjectMonthlyExpenseLoansInput {
  /** Items already physically present in the target month (never duplicated). */
  baseItems: MonthlyExpenseItem[];
  /** Every stored monthly document, scanned for loan items. */
  documents: MonthlyExpensesDocument[];
  /**
   * Loan expense ids the user explicitly removed from this month. They are never
   * projected (neither appended nor refreshed) so a deleted installment does not
   * reappear on the next load.
   */
  excludedLoanIds?: string[];
  /** Month (`YYYY-MM`) the loans are being projected into. */
  targetMonth: string;
}

/** Snapshot of the latest known state of a single loan across all documents. */
interface CanonicalLoanSnapshot {
  item: MonthlyExpenseItem;
  month: string;
}

function compareMonthIdentifiers(left: string, right: string): number {
  return left.localeCompare(right);
}

/**
 * Tells whether the target month falls within a loan's installment range
 * `[startMonth, endMonth]`, where `endMonth` is derived from the installment count.
 *
 * @param loan - Loan whose range is evaluated.
 * @param targetMonth - Month (`YYYY-MM`) to test.
 * @returns `true` when the month is covered by the loan range.
 */
function isMonthWithinLoanRange(
  loan: NonNullable<MonthlyExpenseItem["loan"]>,
  targetMonth: string,
): boolean {
  const endMonth = calculateLoanEndMonth({
    installmentCount: loan.installmentCount,
    startMonth: loan.startMonth,
  });

  return (
    compareMonthIdentifiers(targetMonth, loan.startMonth) >= 0 &&
    compareMonthIdentifiers(targetMonth, endMonth) <= 0
  );
}

/**
 * Builds the canonical definition of every loan, keeping the snapshot from its
 * most recent month so changes (amount, installment count) propagate forward.
 *
 * @param documents - Monthly documents to scan for loan items.
 * @returns Latest loan snapshot indexed by stable expense identifier.
 */
function collectCanonicalLoanSnapshots(
  documents: MonthlyExpensesDocument[],
): Map<string, CanonicalLoanSnapshot> {
  const snapshotsByExpenseId = new Map<string, CanonicalLoanSnapshot>();

  for (const document of documents) {
    for (const item of document.items) {
      if (!item.loan) {
        continue;
      }

      const currentSnapshot = snapshotsByExpenseId.get(item.id);

      if (
        !currentSnapshot ||
        compareMonthIdentifiers(document.month, currentSnapshot.month) > 0
      ) {
        snapshotsByExpenseId.set(item.id, { item, month: document.month });
      }
    }
  }

  return snapshotsByExpenseId;
}

/**
 * Strips a canonical loan item down to a projection input: it keeps the loan and
 * expense definition but drops every per-month payment state (payment records,
 * receipts, manual coverage, folders, paid flag). Paid installments and the end
 * month are intentionally left out so they get recomputed against the target
 * month when the document is rebuilt.
 *
 * Clearable definition fields (payment link, share fields, expense folder,
 * occurrences unit, subtotal unit) are emitted with EXPLICIT cleared values
 * (`null`/`false`/default) instead of being omitted, so when the caller overlays
 * this on a stored copy (`{ ...storedItem, ...projected }`) a field the canonical
 * loan no longer sets actually clears the stale value rather than keeping it.
 *
 * @param item - Canonical loan item to project.
 * @returns A loan item input with no per-month payment state.
 */
function toProjectedLoanItemInput(
  item: MonthlyExpenseItem,
): MonthlyExpenseItemInput {
  const loan = item.loan!;

  return {
    currency: item.currency,
    description: item.description,
    expenseFolderId: item.expenseFolderId ?? null,
    id: item.id,
    loan: {
      direction: loan.direction,
      installmentCount: loan.installmentCount,
      ...(loan.lenderId ? { lenderId: loan.lenderId } : {}),
      ...(loan.lenderName ? { lenderName: loan.lenderName } : {}),
      startMonth: loan.startMonth,
    },
    occurrencesPerMonth: item.occurrencesPerMonth,
    occurrencesUnit: item.occurrencesUnit ?? null,
    paymentLink: item.paymentLink ?? null,
    receiptShareMessage: item.receiptShareMessage ?? null,
    receiptSharePhoneDigits: item.receiptSharePhoneDigits ?? null,
    requiresReceiptShare: item.requiresReceiptShare === true,
    sortOrder:
      item.sortOrder !== null && item.sortOrder !== undefined
        ? item.sortOrder
        : null,
    subtotal: item.subtotal,
    subtotalUnit: item.subtotalUnit === "hour" ? "hour" : "occurrence",
  };
}

/**
 * Resolves the loan's shared all-receipts folder (the per-loan Drive folder that
 * is stable across months), preferring explicit folder metadata and falling back
 * to the first receipt, mirroring the repository's own resolution. Returns `null`
 * when the loan has no all-receipts folder yet.
 *
 * @param item - Canonical loan item to read folder metadata from.
 * @returns The all-receipts folder id and view URL, or `null` when absent.
 */
function resolveSharedAllReceiptsFolder(
  item: MonthlyExpenseItem,
): { id: string; viewUrl: string } | null {
  const folderId = item.folders?.allReceiptsFolderId?.trim();
  const folderViewUrl = item.folders?.allReceiptsFolderViewUrl?.trim();

  if (folderId && folderViewUrl) {
    return { id: folderId, viewUrl: folderViewUrl };
  }

  const firstReceipt = item.receipts[0];

  if (firstReceipt?.allReceiptsFolderId && firstReceipt.allReceiptsFolderViewUrl) {
    return {
      id: firstReceipt.allReceiptsFolderId,
      viewUrl: firstReceipt.allReceiptsFolderViewUrl,
    };
  }

  return null;
}

/**
 * Builds the input for a brand-new projected loan (one not yet stored in the
 * target month). On top of the definition, it carries the loan's shared
 * all-receipts folder with the month-specific folder cleared, so persisting the
 * month does not wipe the loan's all-receipts folder metadata in the shared
 * expense row while still keeping the month free of another month's receipts.
 *
 * @param item - Canonical loan item to project.
 * @returns A loan item input with the shared all-receipts folder preserved.
 */
function toNewProjectedLoanItemInput(
  item: MonthlyExpenseItem,
): MonthlyExpenseItemInput {
  const sharedAllReceiptsFolder = resolveSharedAllReceiptsFolder(item);

  return {
    ...toProjectedLoanItemInput(item),
    ...(sharedAllReceiptsFolder
      ? {
          folders: {
            allReceiptsFolderId: sharedAllReceiptsFolder.id,
            allReceiptsFolderViewUrl: sharedAllReceiptsFolder.viewUrl,
            monthlyFolderId: "",
            monthlyFolderViewUrl: "",
          },
        }
      : {}),
  };
}

/**
 * Returns the loan item inputs that should be reflected in the target month:
 *
 * - **Projected (new) loans:** loans whose installment range covers the target
 *   month and that are not yet physically stored in it.
 * - **Refreshed (existing) loans:** loans already stored in the target month
 *   whose canonical (latest) snapshot lives in a *newer* month. Only the loan and
 *   expense definition is emitted (no per-month payment state), so the caller can
 *   overlay it on the stored copy and propagate amount/installment changes while
 *   preserving that month's payment records, receipts, folders and paid flag. When
 *   the stored copy already *is* the latest snapshot, nothing is emitted for it.
 *
 * Every returned input carries the loan's stable `id`; the caller overlays it on a
 * stored item with the same id or appends it when no stored item matches.
 *
 * @param input - Stored documents, target month and the month's existing items.
 * @returns Loan item inputs to overlay or append onto the target month document.
 */
export function projectMonthlyExpenseLoans({
  baseItems,
  documents,
  excludedLoanIds,
  targetMonth,
}: ProjectMonthlyExpenseLoansInput): MonthlyExpenseItemInput[] {
  const existingItemIds = new Set(baseItems.map((item) => item.id));
  const excludedItemIds = new Set(excludedLoanIds ?? []);
  const projectedItems: MonthlyExpenseItemInput[] = [];

  for (const snapshot of collectCanonicalLoanSnapshots(documents).values()) {
    const { item, month } = snapshot;

    // A loan the user explicitly removed from this month is never reflected
    // again, neither as an append nor as a refresh.
    if (excludedItemIds.has(item.id)) {
      continue;
    }

    if (existingItemIds.has(item.id)) {
      // The loan is already stored in the target month. Refresh its definition
      // only when a newer month holds the canonical snapshot AND that canonical
      // range still covers the month; otherwise the stored copy is either already
      // the latest or now out of range (the caller drops out-of-range copies).
      if (
        compareMonthIdentifiers(month, targetMonth) > 0 &&
        isMonthWithinLoanRange(item.loan!, targetMonth)
      ) {
        projectedItems.push(toProjectedLoanItemInput(item));
      }

      continue;
    }

    if (!isMonthWithinLoanRange(item.loan!, targetMonth)) {
      continue;
    }

    projectedItems.push(toNewProjectedLoanItemInput(item));
  }

  return projectedItems;
}

/**
 * Returns the ids of loans stored in the target month whose CANONICAL (latest)
 * snapshot lives in a newer month and whose updated range no longer covers the
 * target month. These already-materialized copies are stale (e.g. the loan's
 * installment count was shortened or its start month moved later) and must be
 * dropped so a no-longer-active installment does not keep showing or get re-saved.
 *
 * Only copies superseded by a *newer* snapshot are reported: a month's own
 * latest definition is left untouched even if it looks out of range.
 *
 * @param input - Stored documents, target month and the month's existing items.
 * @returns The stored loan ids to remove from the target month.
 */
export function getOutOfRangeStoredLoanIds({
  baseItems,
  documents,
  targetMonth,
}: ProjectMonthlyExpenseLoansInput): string[] {
  const canonicalSnapshots = collectCanonicalLoanSnapshots(documents);
  const outOfRangeLoanIds: string[] = [];

  for (const item of baseItems) {
    if (!item.loan) {
      continue;
    }

    const snapshot = canonicalSnapshots.get(item.id);

    if (
      !snapshot ||
      !snapshot.item.loan ||
      compareMonthIdentifiers(snapshot.month, targetMonth) <= 0
    ) {
      continue;
    }

    if (!isMonthWithinLoanRange(snapshot.item.loan, targetMonth)) {
      outOfRangeLoanIds.push(item.id);
    }
  }

  return outOfRangeLoanIds;
}
