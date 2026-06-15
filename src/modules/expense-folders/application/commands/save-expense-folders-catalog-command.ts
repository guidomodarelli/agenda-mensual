import type {
  ExpenseFolderInput,
  ExpenseFoldersCatalogDocumentInput,
} from "../../domain/value-objects/expense-folders-catalog-document";

export interface SaveExpenseFoldersCatalogCommand
  extends ExpenseFoldersCatalogDocumentInput {
  folders: ExpenseFolderInput[];
}
