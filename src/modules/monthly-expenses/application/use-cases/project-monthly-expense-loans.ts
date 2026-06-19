/**
 * Projects recurring expenses (loans with a fixed installment range and
 * open-ended recurring expenses) across every month within their active range so
 * an item added in any month is reflected in the previous, current and following
 * months without manually copying or replicating it.
 *
 * A loan's range is `[startMonth, endMonth]` derived from its installment count;
 * a recurring expense's range is `[startMonth, endMonth ?? open]`, where a present
 * end month means the user cancelled it (months after it stop projecting).
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

/** Snapshot of the latest known state of a single recurring item across all documents. */
interface CanonicalLoanSnapshot {
  item: MonthlyExpenseItem;
  month: string;
}

/** A recurring item's active range; `endMonth === null` means open-ended. */
interface RecurringRange {
  startMonth: string;
  endMonth: string | null;
}

function compareMonthIdentifiers(left: string, right: string): number {
  return left.localeCompare(right);
}

/**
 * Tells whether an item drives a projection (a loan or a recurring expense) and,
 * when it does, returns its active range. A loan's range ends at the month derived
 * from its installment count; a recurring expense's range ends at its `endMonth`
 * (or stays open when the recurrence has not been cancelled).
 *
 * @param item - Expense item to evaluate.
 * @returns The recurring range, or `null` when the item is a plain expense.
 */
function resolveRecurringRange(item: MonthlyExpenseItem): RecurringRange | null {
  if (item.loan) {
    return {
      startMonth: item.loan.startMonth,
      endMonth: calculateLoanEndMonth({
        installmentCount: item.loan.installmentCount,
        startMonth: item.loan.startMonth,
      }),
    };
  }

  if (item.recurrence) {
    return {
      startMonth: item.recurrence.startMonth,
      endMonth: item.recurrence.endMonth,
    };
  }

  return null;
}

/**
 * Tells whether the target month falls within a recurring item's range. An
 * open-ended range (`endMonth === null`) covers every month from its start.
 *
 * @param range - The item's active range.
 * @param targetMonth - Month (`YYYY-MM`) to test.
 * @returns `true` when the month is covered by the range.
 */
function isMonthWithinRange(
  range: RecurringRange,
  targetMonth: string,
): boolean {
  return (
    compareMonthIdentifiers(targetMonth, range.startMonth) >= 0 &&
    (range.endMonth === null ||
      compareMonthIdentifiers(targetMonth, range.endMonth) <= 0)
  );
}

/**
 * Builds the canonical definition of every recurring item, keeping the snapshot
 * from its most recent month so changes (amount, installment count) propagate
 * forward.
 *
 * Recurrence cancellation is resolved separately from the newest-month rule: the
 * canonical recurrence's effective `endMonth` is the EARLIEST end month among all
 * stored snapshots that carry one. This way a cancellation saved in an older month
 * still bounds the recurrence even when a newer, still-open snapshot exists (e.g.
 * a later month was materialized before the user navigated back to cancel from an
 * earlier month). Reactivation clears the end month from every stored month, so
 * no snapshot carries one and the recurrence becomes open again.
 *
 * @param documents - Monthly documents to scan for recurring items.
 * @returns Latest snapshot indexed by stable expense identifier, with each
 *   recurrence's end month set to the earliest cancellation across all months.
 */
function collectCanonicalLoanSnapshots(
  documents: MonthlyExpensesDocument[],
): Map<string, CanonicalLoanSnapshot> {
  const snapshotsByExpenseId = new Map<string, CanonicalLoanSnapshot>();
  const earliestRecurrenceEndByExpenseId = new Map<string, string>();

  for (const document of documents) {
    for (const item of document.items) {
      if (!item.loan && !item.recurrence) {
        continue;
      }

      const currentSnapshot = snapshotsByExpenseId.get(item.id);

      if (
        !currentSnapshot ||
        compareMonthIdentifiers(document.month, currentSnapshot.month) > 0
      ) {
        snapshotsByExpenseId.set(item.id, { item, month: document.month });
      }

      const recurrenceEndMonth = item.recurrence?.endMonth;

      if (recurrenceEndMonth) {
        const currentEarliest = earliestRecurrenceEndByExpenseId.get(item.id);

        if (
          !currentEarliest ||
          compareMonthIdentifiers(recurrenceEndMonth, currentEarliest) < 0
        ) {
          earliestRecurrenceEndByExpenseId.set(item.id, recurrenceEndMonth);
        }
      }
    }
  }

  // Override each recurrence's canonical end month with the earliest cancellation
  // seen across every stored month, so a cancellation from any month wins over a
  // newer open snapshot. Loans are unaffected (their range comes from the
  // installment count, not from a stored end month).
  for (const [expenseId, snapshot] of snapshotsByExpenseId) {
    const earliestEnd = earliestRecurrenceEndByExpenseId.get(expenseId);
    const { recurrence } = snapshot.item;

    if (recurrence && earliestEnd && recurrence.endMonth !== earliestEnd) {
      snapshotsByExpenseId.set(expenseId, {
        ...snapshot,
        item: {
          ...snapshot.item,
          recurrence: { ...recurrence, endMonth: earliestEnd },
        },
      });
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
  const { loan, recurrence } = item;

  return {
    currency: item.currency,
    description: item.description,
    expenseFolderId: item.expenseFolderId ?? null,
    id: item.id,
    ...(loan
      ? {
          loan: {
            direction: loan.direction,
            installmentCount: loan.installmentCount,
            ...(loan.lenderId ? { lenderId: loan.lenderId } : {}),
            ...(loan.lenderName ? { lenderName: loan.lenderName } : {}),
            startMonth: loan.startMonth,
          },
        }
      : {}),
    ...(recurrence
      ? {
          recurrence: {
            startMonth: recurrence.startMonth,
            ...(recurrence.endMonth ? { endMonth: recurrence.endMonth } : {}),
          },
        }
      : {}),
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
    // collectCanonicalLoanSnapshots only keeps loan/recurrence items, so the
    // range always resolves.
    const range = resolveRecurringRange(item)!;

    // A recurring item the user explicitly removed from this month is never
    // reflected again, neither as an append nor as a refresh.
    if (excludedItemIds.has(item.id)) {
      continue;
    }

    if (existingItemIds.has(item.id)) {
      // The item is already stored in the target month. Refresh its definition
      // only when a newer month holds the canonical snapshot AND that canonical
      // range still covers the month; otherwise the stored copy is either already
      // the latest or now out of range (the caller drops out-of-range copies).
      if (
        compareMonthIdentifiers(month, targetMonth) > 0 &&
        isMonthWithinRange(range, targetMonth)
      ) {
        projectedItems.push(toProjectedLoanItemInput(item));
      }

      continue;
    }

    if (!isMonthWithinRange(range, targetMonth)) {
      continue;
    }

    projectedItems.push(toNewProjectedLoanItemInput(item));
  }

  return projectedItems;
}

/**
 * Returns the ids of recurring items stored in the target month whose canonical
 * range no longer covers the month, so the already-materialized copy is dropped
 * instead of lingering and counting toward the month's totals.
 *
 * The rule differs by kind because the source of the range differs:
 * - **Loans:** only a copy superseded by a *newer* snapshot is reported (its range
 *   comes from the installment count, so a month's own latest definition is left
 *   untouched even if it looks out of range).
 * - **Recurring expenses:** the cancellation end month is an absolute bound. A
 *   stored row is dropped whenever the target month falls outside the effective
 *   recurrence range, even when this month is its own newest snapshot (e.g. a
 *   future month was materialized before the user cancelled the recurrence from an
 *   earlier month). The effective end month is the earliest cancellation across
 *   all stored snapshots (see {@link collectCanonicalLoanSnapshots}).
 *
 * @param input - Stored documents, target month and the month's existing items.
 * @returns The stored recurring-item ids to remove from the target month.
 */
export function getOutOfRangeStoredLoanIds({
  baseItems,
  documents,
  targetMonth,
}: ProjectMonthlyExpenseLoansInput): string[] {
  const canonicalSnapshots = collectCanonicalLoanSnapshots(documents);
  const outOfRangeLoanIds: string[] = [];

  for (const item of baseItems) {
    if (!item.loan && !item.recurrence) {
      continue;
    }

    const snapshot = canonicalSnapshots.get(item.id);

    if (!snapshot) {
      continue;
    }

    const canonicalRange = resolveRecurringRange(snapshot.item);

    if (!canonicalRange) {
      continue;
    }

    // Loans only drop when a newer snapshot supersedes the stored copy; a
    // recurrence's stored end month bounds it absolutely, so it is also checked
    // when this month holds its own newest snapshot.
    const isRecurrence = Boolean(snapshot.item.recurrence);

    if (
      !isRecurrence &&
      compareMonthIdentifiers(snapshot.month, targetMonth) <= 0
    ) {
      continue;
    }

    if (!isMonthWithinRange(canonicalRange, targetMonth)) {
      outOfRangeLoanIds.push(item.id);
    }
  }

  return outOfRangeLoanIds;
}
