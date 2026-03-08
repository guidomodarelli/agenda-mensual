import type {
  MonthlyExpenseItem,
  MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import { createEmptyMonthlyExpensesDocument } from "../../domain/value-objects/monthly-expenses-document";

export interface MonthlyExpensesDocumentResult
  extends MonthlyExpensesDocument {
  items: MonthlyExpenseItem[];
}

export function toMonthlyExpensesDocumentResult(
  document: MonthlyExpensesDocument,
): MonthlyExpensesDocumentResult {
  return {
    items: document.items.map((item) => ({ ...item })),
    month: document.month,
  };
}

export function createEmptyMonthlyExpensesDocumentResult(
  month: string,
): MonthlyExpensesDocumentResult {
  return toMonthlyExpensesDocumentResult(createEmptyMonthlyExpensesDocument(month));
}
