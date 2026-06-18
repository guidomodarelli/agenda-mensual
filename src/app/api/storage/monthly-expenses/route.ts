import { getMonthlyExpensesDocument } from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-document";
import { saveMonthlyExpensesDocument } from "@/modules/monthly-expenses/application/use-cases/save-monthly-expenses-document";
import { createMonthlyExpensesApiHandler } from "@/modules/monthly-expenses/infrastructure/api/create-monthly-expenses-api-handler";
import { GoogleDriveMonthlyExpenseReceiptsRepository } from "@/modules/monthly-expenses/infrastructure/google-drive/repositories/google-drive-monthly-expense-receipts-repository";
import { revalidateMonthlyExpensesLoansReportCache } from "@/modules/monthly-expenses/infrastructure/cache/monthly-expenses-loans-report-cache";
import { DrizzleMonthlyExpensesRepository } from "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository";
import { createGetMonthlyExchangeRateSnapshot } from "@/modules/exchange-rates/infrastructure/create-get-monthly-exchange-rate-snapshot";
import { getGoogleDriveClientFromRequest } from "@/modules/auth/infrastructure/google-drive/google-drive-client";
import {
  appLogger,
  createRequestLogContext,
} from "@/modules/shared/infrastructure/observability/app-logger";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const handler = createAppRouteHandler(createMonthlyExpensesApiHandler({
  async load({ database, includeDriveStatuses, month, request, userSubject }) {
    const getExchangeRateSnapshot = createGetMonthlyExchangeRateSnapshot(database);
    let receiptsRepository:
      | GoogleDriveMonthlyExpenseReceiptsRepository
      | undefined;

    if (includeDriveStatuses) {
      try {
        const driveClient = await getGoogleDriveClientFromRequest(request);
        receiptsRepository = new GoogleDriveMonthlyExpenseReceiptsRepository(
          driveClient,
        );
      } catch (error) {
        appLogger.warn(
          "monthly-expenses API GET skipped Drive receipt status verification",
          {
            context: {
              ...createRequestLogContext(request),
              month,
              operation: "monthly-expenses-api:get:skip-drive-verification",
            },
            error,
          },
        );
      }
    }

    return getMonthlyExpensesDocument({
      getExchangeRateSnapshot,
      // Loading an older month can persist a previously missing exchange-rate
      // snapshot, which changes the loans report (e.g. USD loan conversions), so
      // invalidate the cached report when that read-path write happens.
      onExchangeRateSnapshotPersisted: () =>
        revalidateMonthlyExpensesLoansReportCache(userSubject),
      query: {
        includeDriveStatuses,
        month,
      },
      receiptsRepository,
      repository: new DrizzleMonthlyExpensesRepository(database, userSubject),
    });
  },
  async save({ command, database, request, userSubject }) {
    const getExchangeRateSnapshot = createGetMonthlyExchangeRateSnapshot(database);
    const driveClient = await getGoogleDriveClientFromRequest(request);

    const savedDocument = await saveMonthlyExpensesDocument({
      command,
      getExchangeRateSnapshot,
      receiptsRepository: new GoogleDriveMonthlyExpenseReceiptsRepository(
        driveClient,
      ),
      repository: new DrizzleMonthlyExpensesRepository(database, userSubject),
    });

    // A saved document can change loan amounts, installments or lenders, so the
    // cached report is no longer valid for this user.
    revalidateMonthlyExpensesLoansReportCache(userSubject);

    return savedDocument;
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
