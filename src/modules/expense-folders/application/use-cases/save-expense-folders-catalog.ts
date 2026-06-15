import type { ExpenseFoldersRepository } from "../../domain/repositories/expense-folders-repository";
import {
  createExpenseFoldersCatalogDocument,
  type ExpenseFoldersCatalogDocument,
} from "../../domain/value-objects/expense-folders-catalog-document";
import type { SaveExpenseFoldersCatalogCommand } from "../commands/save-expense-folders-catalog-command";
import {
  toStoredExpenseFoldersCatalogResult,
  type StoredExpenseFoldersCatalogResult,
} from "../results/stored-expense-folders-catalog-result";

interface SaveExpenseFoldersCatalogDependencies {
  command: SaveExpenseFoldersCatalogCommand;
  repository: ExpenseFoldersRepository;
}

export async function saveExpenseFoldersCatalog({
  command,
  repository,
}: SaveExpenseFoldersCatalogDependencies): Promise<StoredExpenseFoldersCatalogResult> {
  const validatedCatalog: ExpenseFoldersCatalogDocument =
    createExpenseFoldersCatalogDocument(command, "Saving expense folders catalog");

  return toStoredExpenseFoldersCatalogResult(
    await repository.save(validatedCatalog),
  );
}
