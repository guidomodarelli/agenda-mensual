import type {
  MonthlyExpenseCurrency,
  MonthlyExpenseFolders,
  MonthlyExpenseLoan,
  MonthlyExpensePaymentRecord,
  MonthlyExpenseReceipt,
  MonthlyExpenseReceiptShareStatus,
  MonthlyExpensesExchangeRateSnapshot,
  MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import { createEmptyMonthlyExpensesDocument } from "../../domain/value-objects/monthly-expenses-document";

export type MonthlyExpenseDriveResourceStatus =
  | "normal"
  | "trashed"
  | "missing";

export interface MonthlyExpenseReceiptDriveStatus {
  allReceiptsFolderStatus: MonthlyExpenseDriveResourceStatus;
  fileStatus: MonthlyExpenseDriveResourceStatus;
  monthlyFolderStatus?: MonthlyExpenseDriveResourceStatus;
}

export interface MonthlyExpenseReceiptResult extends MonthlyExpenseReceipt {
  allReceiptsFolderStatus?: MonthlyExpenseDriveResourceStatus;
  fileStatus?: MonthlyExpenseDriveResourceStatus;
  monthlyFolderStatus?: MonthlyExpenseDriveResourceStatus;
}

export interface MonthlyExpenseFoldersResult extends MonthlyExpenseFolders {
  allReceiptsFolderStatus?: MonthlyExpenseDriveResourceStatus;
  monthlyFolderStatus?: MonthlyExpenseDriveResourceStatus;
}

export interface MonthlyExpenseItemResult {
  currency: MonthlyExpenseCurrency;
  description: string;
  folders?: MonthlyExpenseFoldersResult;
  id: string;
  isPaid?: boolean;
  loan?: MonthlyExpenseLoan;
  manualCoveredPayments?: number;
  occurrencesPerMonth: number;
  paymentRecords?: MonthlyExpensePaymentRecord[];
  paymentLink?: string | null;
  receiptShareMessage?: string | null;
  receiptSharePhoneDigits?: string | null;
  receiptShareStatus?: MonthlyExpenseReceiptShareStatus | null;
  requiresReceiptShare?: boolean;
  receipts?: MonthlyExpenseReceiptResult[];
  subtotal: number;
  total: number;
}

export interface MonthlyExpensesDocumentResult {
  exchangeRateLoadError?: string | null;
  exchangeRateSnapshot?: MonthlyExpensesExchangeRateSnapshot | null;
  hasReplicatedFromPreviousMonth?: boolean;
  items: MonthlyExpenseItemResult[];
  month: string;
}

export function toMonthlyExpensesDocumentResult(
  document: MonthlyExpensesDocument,
  exchangeRateLoadError: string | null = null,
  receiptStatusesByFileId: Record<string, MonthlyExpenseReceiptDriveStatus> = {},
  folderStatusesByItemId: Record<
    string,
    Pick<MonthlyExpenseFoldersResult, "allReceiptsFolderStatus" | "monthlyFolderStatus">
  > = {},
): MonthlyExpensesDocumentResult {
  return {
    exchangeRateLoadError,
    exchangeRateSnapshot: document.exchangeRateSnapshot
      ? { ...document.exchangeRateSnapshot }
      : null,
    ...(document.hasReplicatedFromPreviousMonth
      ? {
          hasReplicatedFromPreviousMonth: true,
        }
      : {}),
    items: document.items.map((item) => ({
      ...item,
      ...(item.folders
        ? {
            folders: {
              ...item.folders,
              ...(folderStatusesByItemId[item.id]
                ? folderStatusesByItemId[item.id]
                : {}),
            },
          }
        : {}),
      ...(item.loan ? { loan: { ...item.loan } } : {}),
      receipts: item.receipts.map((receipt) => ({
        ...receipt,
        ...(receiptStatusesByFileId[receipt.fileId]
          ? receiptStatusesByFileId[receipt.fileId]
          : {}),
      })),
    })),
    month: document.month,
  };
}

export function createEmptyMonthlyExpensesDocumentResult(
  month: string,
): MonthlyExpensesDocumentResult {
  return toMonthlyExpensesDocumentResult(createEmptyMonthlyExpensesDocument(month));
}
