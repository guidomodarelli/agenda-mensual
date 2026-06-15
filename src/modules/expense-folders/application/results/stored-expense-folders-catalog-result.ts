import type { StoredExpenseFoldersCatalog } from "../../domain/entities/stored-expense-folders-catalog";

export type StoredExpenseFoldersCatalogResult = StoredExpenseFoldersCatalog;

export function toStoredExpenseFoldersCatalogResult(
  catalog: StoredExpenseFoldersCatalog,
): StoredExpenseFoldersCatalogResult {
  return {
    id: catalog.id,
    name: catalog.name,
  };
}
