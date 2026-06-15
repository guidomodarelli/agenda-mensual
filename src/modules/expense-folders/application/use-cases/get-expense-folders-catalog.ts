import type { ExpenseFoldersRepository } from "../../domain/repositories/expense-folders-repository";
import { createEmptyExpenseFoldersCatalogDocument } from "../../domain/value-objects/expense-folders-catalog-document";
import {
  toExpenseFoldersCatalogDocumentResult,
  type ExpenseFoldersCatalogDocumentResult,
} from "../results/expense-folders-catalog-document-result";

interface GetExpenseFoldersCatalogDependencies {
  repository: ExpenseFoldersRepository;
}

export async function getExpenseFoldersCatalog({
  repository,
}: GetExpenseFoldersCatalogDependencies): Promise<ExpenseFoldersCatalogDocumentResult> {
  const storedCatalog = await repository.get();

  return toExpenseFoldersCatalogDocumentResult(
    storedCatalog ?? createEmptyExpenseFoldersCatalogDocument(),
  );
}
