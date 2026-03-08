import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import { createEmptyMonthlyExpensesDocument } from "../../domain/value-objects/monthly-expenses-document";
import type { GetMonthlyExpensesDocumentQuery } from "../queries/get-monthly-expenses-document-query";
import {
  toMonthlyExpensesDocumentResult,
  type MonthlyExpensesDocumentResult,
} from "../results/monthly-expenses-document-result";

interface GetMonthlyExpensesDocumentDependencies {
  query: GetMonthlyExpensesDocumentQuery;
  repository: MonthlyExpensesRepository;
}

export async function getMonthlyExpensesDocument({
  query,
  repository,
}: GetMonthlyExpensesDocumentDependencies): Promise<MonthlyExpensesDocumentResult> {
  const storedDocument = await repository.getByMonth(query.month);

  return toMonthlyExpensesDocumentResult(
    storedDocument ?? createEmptyMonthlyExpensesDocument(query.month),
  );
}
