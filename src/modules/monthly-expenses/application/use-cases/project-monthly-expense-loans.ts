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
 * Recurrence cancellation is resolved separately from the newest-month rule:
 *
 * - The effective `endMonth` is the EARLIEST end month among all stored snapshots
 *   that carry one, so a cancellation saved in an older month still bounds the
 *   recurrence even when a newer, still-open snapshot exists.
 * - The canonical DEFINITION (amount, payment link, folders, occurrences, etc.)
 *   for a cancelled recurrence is taken from the newest snapshot WITHIN the active
 *   range (document month on or before that earliest end), not from a later
 *   out-of-range month. Otherwise a future month materialized before the
 *   cancellation would leak stale definition fields while only the end month is
 *   corrected. A recurrence without a cancellation (and every loan) keeps the
 *   plain newest-snapshot definition.
 *
 * Reactivation clears the end month from every stored month, so no snapshot
 * carries one and the recurrence becomes open again.
 *
 * @param documents - Monthly documents to scan for recurring items.
 * @returns Canonical snapshot indexed by stable expense identifier, with each
 *   recurrence's end month set to the earliest cancellation across all months.
 */
function collectCanonicalLoanSnapshots(
  documents: MonthlyExpensesDocument[],
): Map<string, CanonicalLoanSnapshot> {
  const earliestRecurrenceEndByExpenseId = new Map<string, string>();

  // Pass 1: the earliest cancellation per recurrence id, across every month.
  for (const document of documents) {
    for (const item of document.items) {
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

  // Pass 2: the canonical definition. `snapshotsByExpenseId` keeps the newest
  // snapshot WITHIN the active range (for a cancelled recurrence, ignoring months
  // after the earliest end); `fallbackByExpenseId` keeps the unconstrained newest
  // so an id whose only snapshots are out of range still resolves.
  const snapshotsByExpenseId = new Map<string, CanonicalLoanSnapshot>();
  const fallbackByExpenseId = new Map<string, CanonicalLoanSnapshot>();

  for (const document of documents) {
    for (const item of document.items) {
      if (!item.loan && !item.recurrence) {
        continue;
      }

      const fallback = fallbackByExpenseId.get(item.id);

      if (
        !fallback ||
        compareMonthIdentifiers(document.month, fallback.month) > 0
      ) {
        fallbackByExpenseId.set(item.id, { item, month: document.month });
      }

      // For a cancelled recurrence, a month after the earliest end is out of
      // range and must not provide the canonical definition.
      const earliestEnd = item.recurrence
        ? earliestRecurrenceEndByExpenseId.get(item.id)
        : undefined;

      if (
        earliestEnd &&
        compareMonthIdentifiers(document.month, earliestEnd) > 0
      ) {
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

  // Pathological fallback: every snapshot of this id is after the earliest end.
  for (const [expenseId, fallback] of fallbackByExpenseId) {
    if (!snapshotsByExpenseId.has(expenseId)) {
      snapshotsByExpenseId.set(expenseId, fallback);
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
  const baseItemsById = new Map(baseItems.map((item) => [item.id, item]));
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
      // when, within range, EITHER a newer month holds the canonical snapshot, OR
      // the stored row is still a PLAIN expense while the canonical is a
      // loan/recurrence. The latter promotes a one-off row left in a future month
      // by a prior replication when the user converts the expense to recurring in
      // an older month (the canonical snapshot is older, so the newer-month rule
      // alone would never refresh it). Otherwise the stored copy is already the
      // latest or out of range (the caller drops out-of-range copies).
      const baseItem = baseItemsById.get(item.id);
      const baseIsPlain =
        baseItem != null && !baseItem.loan && !baseItem.recurrence;

      if (
        isMonthWithinRange(range, targetMonth) &&
        (compareMonthIdentifiers(month, targetMonth) > 0 || baseIsPlain)
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
 * - **Loans:** only a materialized loan copy superseded by a *newer* snapshot is
 *   reported (its range comes from the installment count, so a month's own latest
 *   definition is left untouched even if it looks out of range).
 * - **Recurring expenses:** only the cancellation end month bounds a stored row.
 *   A copy still materialized AFTER the effective end is dropped, even when this
 *   month is its own newest snapshot (e.g. a future month was materialized before
 *   the user cancelled the recurrence from an earlier month). A copy stored BEFORE
 *   the recurrence start is kept: because the store shares one recurrence
 *   definition per id, converting a one-off with past replicas into a recurring
 *   expense makes those past copies load as recurring rows before the start, and
 *   they are real historical occurrences that must not be erased. The effective
 *   end month is the earliest cancellation across all stored snapshots (see
 *   {@link collectCanonicalLoanSnapshots}).
 * - **Stale plain copies:** a one-off row left in a future month by a prior
 *   replication whose id later became a loan/recurrence is dropped only AFTER the
 *   canonical range has ended (the recurrence ended/was cancelled before this
 *   month). A plain copy BEFORE the canonical start is a legitimate historical
 *   one-off that predates the recurrence/loan and is kept. A genuine plain expense
 *   with no loan/recurrence canonical has no snapshot and is left alone.
 *
 * @param input - Stored documents, target month and the month's existing items.
 * @returns The stored item ids to remove from the target month.
 */
export function getOutOfRangeStoredLoanIds({
  baseItems,
  documents,
  targetMonth,
}: ProjectMonthlyExpenseLoansInput): string[] {
  const canonicalSnapshots = collectCanonicalLoanSnapshots(documents);
  const outOfRangeLoanIds: string[] = [];

  for (const item of baseItems) {
    const snapshot = canonicalSnapshots.get(item.id);

    if (!snapshot) {
      continue;
    }

    const canonicalRange = resolveRecurringRange(snapshot.item);

    if (!canonicalRange) {
      continue;
    }

    const baseIsPlain = !item.loan && !item.recurrence;
    const isRecurrence = Boolean(snapshot.item.recurrence);

    if (baseIsPlain) {
      // A stale plain copy left by a prior replication is dropped only AFTER the
      // canonical range has ended (the recurrence/loan stopped before this month).
      // A plain copy BEFORE the canonical start is a legitimate historical one-off
      // that predates the recurrence/loan and must be kept.
      const { endMonth } = canonicalRange;

      if (
        endMonth != null &&
        compareMonthIdentifiers(targetMonth, endMonth) > 0
      ) {
        outOfRangeLoanIds.push(item.id);
      }

      continue;
    }

    if (!isRecurrence) {
      // A materialized loan copy only drops when a NEWER snapshot supersedes it
      // and pushes the installment range past this month; a month that holds its
      // own newest snapshot keeps its definition untouched.
      if (compareMonthIdentifiers(snapshot.month, targetMonth) <= 0) {
        continue;
      }

      if (!isMonthWithinRange(canonicalRange, targetMonth)) {
        outOfRangeLoanIds.push(item.id);
      }

      continue;
    }

    // A recurrence shares one stored definition across every month of its id, so
    // a copy replicated into a month BEFORE the chosen start loads carrying the
    // recurrence (this happens when an existing one-off with past replicas is
    // converted into a recurring expense in a later month). That pre-start copy
    // is real historical data and must be kept; only a copy still materialized
    // AFTER the cancellation end is dropped so a cancelled recurrence stops
    // counting.
    const { endMonth } = canonicalRange;

    if (endMonth != null && compareMonthIdentifiers(targetMonth, endMonth) > 0) {
      outOfRangeLoanIds.push(item.id);
    }
  }

  return outOfRangeLoanIds;
}
