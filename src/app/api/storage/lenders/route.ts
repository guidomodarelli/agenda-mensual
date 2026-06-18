import { getLendersCatalog } from "@/modules/lenders/application/use-cases/get-lenders-catalog";
import { saveLendersCatalog } from "@/modules/lenders/application/use-cases/save-lenders-catalog";
import { createLendersApiHandler } from "@/modules/lenders/infrastructure/api/create-lenders-api-handler";
import { DrizzleLendersRepository } from "@/modules/lenders/infrastructure/turso/repositories/drizzle-lenders-repository";
import { revalidateMonthlyExpensesLoansReportCache } from "@/modules/monthly-expenses/infrastructure/cache/monthly-expenses-loans-report-cache";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(createLendersApiHandler({
  async get({ database, userSubject }) {
    return getLendersCatalog({
      repository: new DrizzleLendersRepository(database, userSubject),
    });
  },
  async save({ command, database, userSubject }) {
    const savedCatalog = await saveLendersCatalog({
      command,
      repository: new DrizzleLendersRepository(database, userSubject),
    });

    // Lender names and types are denormalized into the loans report, so editing
    // the catalog must invalidate the user's cached report.
    revalidateMonthlyExpensesLoansReportCache(userSubject);

    return savedCatalog;
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
