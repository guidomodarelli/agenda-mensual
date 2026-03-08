import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import {
  createMonthlyExpensesDocument,
  type MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import type { SaveMonthlyExpensesCommand } from "../commands/save-monthly-expenses-command";
import {
  toStoredMonthlyExpensesDocumentResult,
  type StoredMonthlyExpensesDocumentResult,
} from "../results/stored-monthly-expenses-document-result";

interface SaveMonthlyExpensesDocumentDependencies {
  command: SaveMonthlyExpensesCommand;
  repository: MonthlyExpensesRepository;
}

export async function saveMonthlyExpensesDocument({
  command,
  repository,
}: SaveMonthlyExpensesDocumentDependencies): Promise<StoredMonthlyExpensesDocumentResult> {
  const validatedDocument: MonthlyExpensesDocument = createMonthlyExpensesDocument(
    command,
    "Saving monthly expenses",
  );

  return toStoredMonthlyExpensesDocumentResult(
    await repository.save(validatedDocument),
  );
}
