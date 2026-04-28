import type {
  MonthlyExpenseItemInput,
  MonthlyExpensesDocumentInput,
} from "../../domain/value-objects/monthly-expenses-document";

export interface SaveMonthlyExpensesCommand
  extends MonthlyExpensesDocumentInput {
  hasReplicatedFromPreviousMonth?: boolean;
  items: MonthlyExpenseItemInput[];
}
