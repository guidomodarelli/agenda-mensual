import type { LenderType } from "@/modules/lenders/domain/value-objects/lenders-catalog-document";

export type MonthlyExpensesLoanReportLenderType = LenderType | "unassigned";
export type MonthlyExpensesLoanReportDirection = "payable" | "receivable";
export type MonthlyExpensesLoanReportCurrency = "ARS" | "USD";

export interface MonthlyExpensesLoanReportActiveLoan {
  /**
   * Installment due in the current month, converted to ARS (one installment),
   * or `0` when the loan has not started yet. This is the "this month" figure.
   */
  currentMonthAmount: number;
  /** Current-month installment in the loan's own currency when USD, else `null`. */
  currentMonthAmountOriginal: number | null;
  /** ISO month (`YYYY-MM`) of the loan's last installment. */
  endMonth: string;
  description: string;
  installmentCount: number;
  /** True when the final installment falls in the current or next month. */
  isDueSoon: boolean;
  paidInstallments: number;
  currency: MonthlyExpensesLoanReportCurrency;
  /** Remaining amount (future installments) converted to ARS. */
  remainingAmount: number;
  /**
   * Remaining amount in the loan's own currency when it is not ARS (used to show
   * the original USD figure next to the converted one). `null` for ARS loans.
   */
  remainingAmountOriginal: number | null;
}

export interface MonthlyExpensesLoanReportProjectionMonth {
  amount: number;
  month: string;
}

export interface MonthlyExpensesLoanReportEntry {
  activeLoanCount: number;
  /** Active loans for this lender entry, ordered by remaining amount desc. */
  activeLoans: MonthlyExpensesLoanReportActiveLoan[];
  direction?: MonthlyExpensesLoanReportDirection;
  firstDebtMonth: string | null;
  lenderId: string | null;
  lenderName: string;
  lenderType: MonthlyExpensesLoanReportLenderType;
  latestRecordedMonth: string | null;
  remainingAmount: number;
  trackedLoanCount: number;
}

export interface MonthlyExpensesLoansReportResult {
  entries: MonthlyExpensesLoanReportEntry[];
  summary: {
    activeLoanCount: number;
    lenderCount: number;
    /** Payable amount due in the current month (one installment per owed loan). */
    payableCurrentMonthAmount?: number;
    /** Amount payable per upcoming month, from the current month forward. */
    monthlyProjection?: MonthlyExpensesLoanReportProjectionMonth[];
    netRemainingAmount?: number;
    payableRemainingAmount?: number;
    receivableRemainingAmount?: number;
    remainingAmount: number;
    trackedLoanCount: number;
  };
}

export function createEmptyMonthlyExpensesLoansReportResult(): MonthlyExpensesLoansReportResult {
  return {
    entries: [],
    summary: {
      activeLoanCount: 0,
      payableCurrentMonthAmount: 0,
      lenderCount: 0,
      monthlyProjection: [],
      netRemainingAmount: 0,
      payableRemainingAmount: 0,
      receivableRemainingAmount: 0,
      remainingAmount: 0,
      trackedLoanCount: 0,
    },
  };
}
