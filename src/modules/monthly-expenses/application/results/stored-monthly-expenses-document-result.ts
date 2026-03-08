import type { StoredMonthlyExpensesDocument } from "../../domain/entities/stored-monthly-expenses-document";

export type StoredMonthlyExpensesDocumentResult = StoredMonthlyExpensesDocument;

export function toStoredMonthlyExpensesDocumentResult(
  document: StoredMonthlyExpensesDocument,
): StoredMonthlyExpensesDocumentResult {
  return {
    id: document.id,
    month: document.month,
    name: document.name,
    viewUrl: document.viewUrl,
  };
}
