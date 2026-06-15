import type {
  ExpenseFolder,
  ExpenseFoldersCatalogDocument,
} from "../../domain/value-objects/expense-folders-catalog-document";
import { createEmptyExpenseFoldersCatalogDocument } from "../../domain/value-objects/expense-folders-catalog-document";

export interface ExpenseFoldersCatalogDocumentResult
  extends ExpenseFoldersCatalogDocument {
  folders: ExpenseFolder[];
}

export function toExpenseFoldersCatalogDocumentResult(
  document: ExpenseFoldersCatalogDocument,
): ExpenseFoldersCatalogDocumentResult {
  return {
    folders: document.folders.map((folder) => ({ ...folder })),
  };
}

export function createEmptyExpenseFoldersCatalogDocumentResult(): ExpenseFoldersCatalogDocumentResult {
  return toExpenseFoldersCatalogDocumentResult(
    createEmptyExpenseFoldersCatalogDocument(),
  );
}
