import type {
  MonthlyExpensesEditableReceipt,
  MonthlyExpensesEditableRow,
} from "./monthly-expenses-table.types";

function parseNonNegativeInteger(value: string): number {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return 0;
  }

  return numericValue;
}

function parsePositiveInteger(value: string): number {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue;
}

function getCoveredPaymentsByReceipts(
  receipts: MonthlyExpensesEditableReceipt[],
): number {
  return receipts.reduce(
    (coveredPayments, receipt) => coveredPayments + receipt.coveredPayments,
    0,
  );
}

/**
 * Derives a row's payment coverage: how many payments are required for the month
 * and how many are already covered by manual entries plus receipts.
 */
export function getPaymentProgress(row: MonthlyExpensesEditableRow): {
  coveredPayments: number;
  coveredPaymentsByReceipts: number;
  requiredPayments: number;
} {
  const requiredPayments = parsePositiveInteger(row.occurrencesPerMonth);
  const manualCoveredPayments = parseNonNegativeInteger(
    row.manualCoveredPayments,
  );
  const coveredPaymentsByReceipts = getCoveredPaymentsByReceipts(row.receipts);

  return {
    coveredPayments: manualCoveredPayments + coveredPaymentsByReceipts,
    coveredPaymentsByReceipts,
    requiredPayments,
  };
}

/** True when the row requires at least one payment and all of them are covered. */
export function isPaymentCompleted(row: MonthlyExpensesEditableRow): boolean {
  const { coveredPayments, requiredPayments } = getPaymentProgress(row);

  return requiredPayments > 0 && coveredPayments >= requiredPayments;
}
