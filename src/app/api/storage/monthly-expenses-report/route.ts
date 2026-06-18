import { getLendersCatalog } from "@/modules/lenders/application/use-cases/get-lenders-catalog";
import { DrizzleLendersRepository } from "@/modules/lenders/infrastructure/turso/repositories/drizzle-lenders-repository";
import {
  getCurrentMonthIdentifier,
  getMonthlyExpensesLoansReport,
} from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-loans-report";
import { createMonthlyExpensesLoansReportApiHandler } from "@/modules/monthly-expenses/infrastructure/api/create-monthly-expenses-loans-report-api-handler";
import { getCachedMonthlyExpensesLoansReport } from "@/modules/monthly-expenses/infrastructure/cache/monthly-expenses-loans-report-cache";
import { DrizzleMonthlyExpensesRepository } from "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(createMonthlyExpensesLoansReportApiHandler({
  async load({ database, userSubject }) {
    const currentMonth = getCurrentMonthIdentifier();

    // Lenders are fetched inside the compute callback so a cache hit skips that
    // query too. The cache is shared with SSR, so client refreshes after a write
    // (which invalidates the tag) recompute exactly once.
    return getCachedMonthlyExpensesLoansReport({
      currentMonth,
      userSubject,
      computeReport: async () => {
        const lendersCatalog = await getLendersCatalog({
          repository: new DrizzleLendersRepository(database, userSubject),
        });

        return getMonthlyExpensesLoansReport({
          currentMonth,
          lenders: lendersCatalog.lenders,
          repository: new DrizzleMonthlyExpensesRepository(database, userSubject),
        });
      },
    });
  },
}));

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
