export interface UploadMonthlyExpenseReceiptCommand {
  contentBase64: string;
  coveredPayments: number;
  expenseDescription: string;
  fileName: string;
  month: string;
  mimeType: string;
}
