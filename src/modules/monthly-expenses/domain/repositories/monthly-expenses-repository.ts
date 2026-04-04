import type { StoredMonthlyExpensesDocument } from "../entities/stored-monthly-expenses-document";
import type { MonthlyExpensesDocument } from "../value-objects/monthly-expenses-document";

export interface MonthlyExpensesRepository {
  getByMonth(month: string): Promise<MonthlyExpensesDocument | null>;
  getOldestStoredMonth?(): Promise<string | null>;
  listAll(): Promise<MonthlyExpensesDocument[]>;
  listMonthsWithExpenses?(): Promise<string[]>;
  save(
    document: MonthlyExpensesDocument,
  ): Promise<StoredMonthlyExpensesDocument>;
}
