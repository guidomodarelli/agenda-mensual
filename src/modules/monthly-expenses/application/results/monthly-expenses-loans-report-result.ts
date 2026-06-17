import type { LenderType } from "@/modules/lenders/domain/value-objects/lenders-catalog-document";

export type MonthlyExpensesLoanReportLenderType = LenderType | "unassigned";
export type MonthlyExpensesLoanReportDirection = "payable" | "receivable";

export interface MonthlyExpensesLoanReportExpense {
  /** Number of active loans that share this description for the lender entry. */
  count: number;
  description: string;
}

export interface MonthlyExpensesLoanReportEntry {
  activeLoanCount: number;
  direction?: MonthlyExpensesLoanReportDirection;
  expenseDescriptions: MonthlyExpensesLoanReportExpense[];
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
      lenderCount: 0,
      netRemainingAmount: 0,
      payableRemainingAmount: 0,
      receivableRemainingAmount: 0,
      remainingAmount: 0,
      trackedLoanCount: 0,
    },
  };
}
