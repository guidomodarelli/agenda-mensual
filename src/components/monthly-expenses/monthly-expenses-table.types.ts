/**
 * Shared data shapes for the monthly expenses table feature. These types are the
 * vocabulary that the table component, its cells, and its pure helpers all speak,
 * so they live in a dependency-free module to avoid coupling helpers to the
 * component file.
 */

export type TechnicalErrorCode = `E${number}${number}${number}${number}`;

export type MonthlyExpenseCurrency = "ARS" | "USD";

export type MonthlyExpenseLoanDirection = "payable" | "receivable";

export type MonthlyExpenseSubtotalUnit = "occurrence" | "hour";

export type MonthlyExpenseReceiptShareStatus = "pending" | "sent";

export type MonthlyExpenseDriveResourceStatus =
  | "normal"
  | "trashed"
  | "missing";

/** Historical exchange-rate snapshot used to convert amounts into ARS. */
export interface ExchangeRateSnapshot {
  blueRate: number;
  month: string;
  officialRate: number;
  solidarityRate: number;
}

export interface MonthlyExpensesEditableReceipt {
  allReceiptsFolderId: string;
  allReceiptsFolderStatus?: MonthlyExpenseDriveResourceStatus;
  allReceiptsFolderViewUrl: string;
  coveredPayments: number;
  fileId: string;
  fileName: string;
  fileStatus?: MonthlyExpenseDriveResourceStatus;
  fileViewUrl: string;
  monthlyFolderId: string;
  monthlyFolderStatus?: MonthlyExpenseDriveResourceStatus;
  monthlyFolderViewUrl: string;
}

export interface MonthlyExpensesEditablePaymentRecord {
  coveredPayments: number;
  id: string;
  receipt?: MonthlyExpensesEditableReceipt;
  registeredAt: string | null;
  sendStatus?: MonthlyExpenseReceiptShareStatus;
}

export interface MonthlyExpensesEditableRow {
  allReceiptsFolderId: string;
  allReceiptsFolderStatus?: MonthlyExpenseDriveResourceStatus;
  allReceiptsFolderViewUrl: string;
  currency: MonthlyExpenseCurrency;
  description: string;
  expenseFolderId: string;
  id: string;
  installmentCount: string;
  isLoan: boolean;
  lenderId: string;
  lenderName: string;
  loanDirection?: MonthlyExpenseLoanDirection;
  loanEndMonth: string;
  loanPaidInstallments: number | null;
  loanProgress: string;
  loanRemainingInstallments: number | null;
  loanTotalInstallments: number | null;
  manualCoveredPayments: string;
  occurrencesPerMonth: string;
  occurrencesUnit: string;
  paymentRecords?: MonthlyExpensesEditablePaymentRecord[];
  paymentLink: string;
  receiptShareMessage: string;
  receiptSharePhoneDigits: string;
  requiresReceiptShare: boolean;
  receipts: MonthlyExpensesEditableReceipt[];
  monthlyFolderId: string;
  monthlyFolderStatus?: MonthlyExpenseDriveResourceStatus;
  monthlyFolderViewUrl: string;
  sortOrder: number | null;
  startMonth: string;
  subtotal: string;
  subtotalUnit?: MonthlyExpenseSubtotalUnit;
  total: string;
}

export interface MonthlyExpensesReplicableOption {
  description: string;
  id: string;
}
