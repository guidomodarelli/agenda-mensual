import type {
  MonthlyExpenseReceiptShareStatus,
  MonthlyExpensesEditableRow,
} from "./monthly-expenses-table.types";

/**
 * Counts how many receipt payments were already shared versus the total number
 * of receipt payments for an expense.
 *
 * @param row - Expense row carrying its payment records and share requirement.
 * @returns `{ receiptCount, sentCount }`, or `null` when sharing does not apply
 *   or there are no receipt payments to share.
 */
export function getReceiptShareProgress(
  row: Pick<
    MonthlyExpensesEditableRow,
    "paymentRecords" | "requiresReceiptShare"
  >,
): { receiptCount: number; sentCount: number } | null {
  if (!row.requiresReceiptShare) {
    return null;
  }

  const receiptPaymentRecords = (row.paymentRecords ?? []).filter(
    (paymentRecord) => Boolean(paymentRecord.receipt),
  );

  if (receiptPaymentRecords.length === 0) {
    return null;
  }

  const sentCount = receiptPaymentRecords.filter(
    (paymentRecord) => paymentRecord.sendStatus === "sent",
  ).length;

  return { receiptCount: receiptPaymentRecords.length, sentCount };
}

/**
 * Aggregates the per-payment share status into a single expense-level status.
 *
 * Returns `null` when the expense does not require sharing or has no receipt
 * payments yet. Otherwise it returns `"sent"` only when every receipt payment
 * was already shared, and `"pending"` when at least one is still unsent.
 *
 * @param row - Expense row carrying its payment records and share requirement.
 * @returns The aggregated share status or `null` when not applicable.
 */
export function getNormalizedReceiptShareStatus(
  row: Pick<
    MonthlyExpensesEditableRow,
    "paymentRecords" | "requiresReceiptShare"
  >,
): MonthlyExpenseReceiptShareStatus | null {
  const progress = getReceiptShareProgress(row);

  if (!progress) {
    return null;
  }

  return progress.sentCount >= progress.receiptCount ? "sent" : "pending";
}
