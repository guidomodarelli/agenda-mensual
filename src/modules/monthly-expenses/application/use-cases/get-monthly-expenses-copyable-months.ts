import type { MonthlyExpensesRepository } from "../../domain/repositories/monthly-expenses-repository";
import type { GetMonthlyExpensesCopyableMonthsQuery } from "../queries/get-monthly-expenses-copyable-months-query";
import {
  createEmptyMonthlyExpensesCopyableMonthsResult,
  type MonthlyExpensesCopyableMonthsResult,
} from "../results/monthly-expenses-copyable-months-result";

interface GetMonthlyExpensesCopyableMonthsDependencies {
  query: GetMonthlyExpensesCopyableMonthsQuery;
  repository: MonthlyExpensesRepository;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function getMonthIndex(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);

  return year * 12 + (monthNumber - 1);
}

function toMonthIdentifier(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const monthNumber = (monthIndex % 12) + 1;

  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function getPreviousMonthIdentifier(month: string): string {
  return toMonthIdentifier(getMonthIndex(month) - 1);
}

export async function getMonthlyExpensesCopyableMonths({
  query,
  repository,
}: GetMonthlyExpensesCopyableMonthsDependencies): Promise<MonthlyExpensesCopyableMonthsResult> {
  const targetMonth = query.targetMonth.trim();

  if (!MONTH_PATTERN.test(targetMonth)) {
    throw new Error(
      "Getting copyable monthly expenses months requires targetMonth in YYYY-MM format.",
    );
  }

  const previousMonth = getPreviousMonthIdentifier(targetMonth);
  const sourceMonths =
    typeof repository.listMonthsWithExpenses === "function"
      ? await repository.listMonthsWithExpenses()
      : (await repository.listAll())
        .filter((document) => document.items.length > 0)
        .map((document) => document.month);
  const validSourceMonths = Array.from(
    new Set(
      sourceMonths.filter(
        (month) => MONTH_PATTERN.test(month) && month <= previousMonth,
      ),
    ),
  ).sort((left, right) => right.localeCompare(left));

  if (validSourceMonths.length === 0) {
    return createEmptyMonthlyExpensesCopyableMonthsResult(targetMonth);
  }

  return {
    defaultSourceMonth: validSourceMonths.includes(previousMonth)
      ? previousMonth
      : validSourceMonths[0],
    sourceMonths: validSourceMonths,
    targetMonth,
  };
}
