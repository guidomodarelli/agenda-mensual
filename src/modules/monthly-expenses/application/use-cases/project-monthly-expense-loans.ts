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
    ...(item.expenseFolderId ? { expenseFolderId: item.expenseFolderId } : {}),
    id: item.id,
    loan: {
      direction: loan.direction,
      installmentCount: loan.installmentCount,
      ...(loan.lenderId ? { lenderId: loan.lenderId } : {}),
      ...(loan.lenderName ? { lenderName: loan.lenderName } : {}),
      startMonth: loan.startMonth,
    },
    occurrencesPerMonth: item.occurrencesPerMonth,
    ...(item.occurrencesUnit ? { occurrencesUnit: item.occurrencesUnit } : {}),
    ...(item.paymentLink ? { paymentLink: item.paymentLink } : {}),
    ...(item.receiptShareMessage
      ? { receiptShareMessage: item.receiptShareMessage }
      : {}),
    ...(item.receiptSharePhoneDigits
      ? { receiptSharePhoneDigits: item.receiptSharePhoneDigits }
      : {}),
    ...(item.requiresReceiptShare ? { requiresReceiptShare: true } : {}),
    ...(item.sortOrder !== null && item.sortOrder !== undefined
      ? { sortOrder: item.sortOrder }
      : {}),
    subtotal: item.subtotal,
    ...(item.subtotalUnit === "hour" ? { subtotalUnit: item.subtotalUnit } : {}),
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
  targetMonth,
}: ProjectMonthlyExpenseLoansInput): MonthlyExpenseItemInput[] {
  const existingItemIds = new Set(baseItems.map((item) => item.id));
  const projectedItems: MonthlyExpenseItemInput[] = [];

  for (const snapshot of collectCanonicalLoanSnapshots(documents).values()) {
    const { item, month } = snapshot;

    if (existingItemIds.has(item.id)) {
      // The loan is already stored in the target month. Refresh its definition
      // only when a newer month holds the canonical snapshot; otherwise the
      // stored copy already is the latest and nothing changes.
      if (compareMonthIdentifiers(month, targetMonth) > 0) {
        projectedItems.push(toProjectedLoanItemInput(item));
      }

      continue;
    }

    const loan = item.loan!;
    const endMonth = calculateLoanEndMonth({
      installmentCount: loan.installmentCount,
      startMonth: loan.startMonth,
    });
    const isWithinLoanRange =
      compareMonthIdentifiers(targetMonth, loan.startMonth) >= 0 &&
      compareMonthIdentifiers(targetMonth, endMonth) <= 0;

    if (!isWithinLoanRange) {
      continue;
    }

    projectedItems.push(toProjectedLoanItemInput(item));
  }

  return projectedItems;
}
