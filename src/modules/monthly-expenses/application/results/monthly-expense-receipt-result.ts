import type { MonthlyExpenseReceiptUpload } from "../../domain/repositories/monthly-expense-receipts-repository";

export interface MonthlyExpenseReceiptResult {
  allReceiptsFolderId: string;
  allReceiptsFolderViewUrl: string;
  coveredPayments: number;
  fileId: string;
  fileName: string;
  fileViewUrl: string;
  monthlyFolderId: string;
  monthlyFolderViewUrl: string;
}

export function toMonthlyExpenseReceiptResult(
  upload: MonthlyExpenseReceiptUpload,
): MonthlyExpenseReceiptResult {
  return {
    allReceiptsFolderId: upload.allReceiptsFolderId,
    allReceiptsFolderViewUrl: upload.allReceiptsFolderViewUrl,
    coveredPayments: upload.coveredPayments,
    fileId: upload.fileId,
    fileName: upload.fileName,
    fileViewUrl: upload.fileViewUrl,
    monthlyFolderId: upload.monthlyFolderId,
    monthlyFolderViewUrl: upload.monthlyFolderViewUrl,
  };
}
