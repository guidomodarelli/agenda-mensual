import { getLendersCatalog } from "@/modules/lenders/application/use-cases/get-lenders-catalog";
import { DrizzleLendersRepository } from "@/modules/lenders/infrastructure/turso/repositories/drizzle-lenders-repository";
import { getMonthlyExpensesLoansReport } from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-loans-report";
import { createMonthlyExpensesLoansReportApiHandler } from "@/modules/monthly-expenses/infrastructure/api/create-monthly-expenses-loans-report-api-handler";
import { DrizzleMonthlyExpensesRepository } from "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository";

export default createMonthlyExpensesLoansReportApiHandler({
  async load({ database, userSubject }) {
    const lendersCatalog = await getLendersCatalog({
      repository: new DrizzleLendersRepository(database, userSubject),
    });

    return getMonthlyExpensesLoansReport({
      lenders: lendersCatalog.lenders,
      repository: new DrizzleMonthlyExpensesRepository(database, userSubject),
    });
  },
});
