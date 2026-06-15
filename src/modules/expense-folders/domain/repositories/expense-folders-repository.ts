import type { StoredExpenseFoldersCatalog } from "../entities/stored-expense-folders-catalog";
import type { ExpenseFoldersCatalogDocument } from "../value-objects/expense-folders-catalog-document";

export interface ExpenseFoldersRepository {
  get(): Promise<ExpenseFoldersCatalogDocument | null>;
  save(
    document: ExpenseFoldersCatalogDocument,
  ): Promise<StoredExpenseFoldersCatalog>;
}
