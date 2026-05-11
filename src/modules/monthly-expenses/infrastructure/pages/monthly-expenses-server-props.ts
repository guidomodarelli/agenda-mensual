import type { GetServerSidePropsContext } from "next";

import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import { GOOGLE_OAUTH_SCOPES } from "@/modules/auth/infrastructure/oauth/google-oauth-scopes";
import { createGetMonthlyExchangeRateSnapshot } from "@/modules/exchange-rates/infrastructure/create-get-monthly-exchange-rate-snapshot";
import {
  createEmptyLendersCatalogDocumentResult,
} from "@/modules/lenders/application/results/lenders-catalog-document-result";
import {
  getLendersCatalog,
} from "@/modules/lenders/application/use-cases/get-lenders-catalog";
import {
  createEmptyMonthlyExpensesCopyableMonthsResult,
} from "@/modules/monthly-expenses/application/results/monthly-expenses-copyable-months-result";
import {
  createEmptyMonthlyExpensesDocumentResult,
} from "@/modules/monthly-expenses/application/results/monthly-expenses-document-result";
import {
  createEmptyMonthlyExpensesLoansReportResult,
} from "@/modules/monthly-expenses/application/results/monthly-expenses-loans-report-result";
import {
  getMonthlyExpensesCopyableMonths,
} from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-copyable-months";
import {
  getMonthlyExpensesDocument,
} from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-document";
import {
  getMonthlyExpensesLoansReport,
} from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-loans-report";
import type {
  MonthlyExpenseReceiptsRepository,
} from "@/modules/monthly-expenses/domain/repositories/monthly-expense-receipts-repository";
import { getStorageBootstrap } from "@/modules/storage/application/queries/get-storage-bootstrap";
import {
  appLogger,
  createRequestLogContext,
} from "@/modules/shared/infrastructure/observability/app-logger";
import {
  TECHNICAL_ERROR_CODES,
} from "@/modules/shared/infrastructure/errors/technical-error-codes";

import type {
  MonthlyExpensesPageProps,
  MonthlyExpensesTabKey,
} from "@/modules/monthly-expenses/shared/pages/monthly-expenses-page";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
function getCurrentMonthIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getRequestedMonth(queryValue: GetServerSidePropsContext["query"]["month"]) {
  const monthValue = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  const normalizedMonth = monthValue?.trim();

  return normalizedMonth && MONTH_PATTERN.test(normalizedMonth)
    ? normalizedMonth
    : getCurrentMonthIdentifier();
}

function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([entryKey, entryValue]) => [entryKey, omitUndefinedDeep(entryValue)]),
    ) as T;
  }

  return value;
}

function isRecoverableGoogleOAuthError(error: unknown): boolean {
  return (
    error instanceof GoogleOAuthAuthenticationError ||
    error instanceof GoogleOAuthConfigurationError ||
    (error instanceof Error &&
      (error.name === "GoogleOAuthAuthenticationError" ||
        error.name === "GoogleOAuthConfigurationError"))
  );
}

export function toSerializableMonthlyExpensesPageProps(
  props: MonthlyExpensesPageProps,
): MonthlyExpensesPageProps {
  return omitUndefinedDeep(props);
}

export async function getMonthlyExpensesServerSidePropsForTab(
  context: GetServerSidePropsContext,
  initialActiveTab: MonthlyExpensesTabKey,
): Promise<{ props: MonthlyExpensesPageProps }> {
  const selectedMonth = getRequestedMonth(context.query.month);
  const requestContext = createRequestLogContext(context.req);
  const bootstrap = getStorageBootstrap({
    isGoogleOAuthConfigured: isGoogleOAuthConfigured(),
    requiredScopes: GOOGLE_OAUTH_SCOPES,
  });

  if (bootstrap.authStatus !== "configured") {
    appLogger.warn("monthly-expenses SSR bootstrap is not configured", {
      context: {
        ...requestContext,
        authStatus: bootstrap.authStatus,
        initialActiveTab,
        month: selectedMonth,
        operation: "monthly-expenses-ssr:bootstrap",
      },
    });

    return {
      props: toSerializableMonthlyExpensesPageProps({
        bootstrap,
        initialCopyableMonths:
          createEmptyMonthlyExpensesCopyableMonthsResult(selectedMonth),
        initialActiveTab,
        initialDocument: createEmptyMonthlyExpensesDocumentResult(
          selectedMonth,
        ),
        initialLendersCatalog: createEmptyLendersCatalogDocumentResult(),
        initialLoansReport: createEmptyMonthlyExpensesLoansReportResult(),
        lendersLoadErrorCode: null,
        lendersLoadError: null,
        loadErrorCode: null,
        loadError: null,
        reportLoadErrorCode: null,
        reportLoadError: null,
      }),
    };
  }

  try {
    const { getAuthenticatedUserSubjectFromRequest } = await import(
      "@/modules/auth/infrastructure/next-auth/authenticated-user-subject"
    );
    const { createMigratedTursoDatabase } = await import(
      "@/modules/shared/infrastructure/database/drizzle/turso-database"
    );
    const { DrizzleMonthlyExpensesRepository } = await import(
      "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository"
    );
    const { GoogleDriveMonthlyExpenseReceiptsRepository } = await import(
      "@/modules/monthly-expenses/infrastructure/google-drive/repositories/google-drive-monthly-expense-receipts-repository"
    );
    const { DrizzleLendersRepository } = await import(
      "@/modules/lenders/infrastructure/turso/repositories/drizzle-lenders-repository"
    );
    const { getGoogleDriveClientFromRequest } = await import(
      "@/modules/auth/infrastructure/google-drive/google-drive-client"
    );

    const userSubject = await getAuthenticatedUserSubjectFromRequest(
      context.req,
    );
    const database = await createMigratedTursoDatabase();
    const monthlyExpensesRepository = new DrizzleMonthlyExpensesRepository(
      database,
      userSubject,
    );
    let receiptsRepository: MonthlyExpenseReceiptsRepository | undefined;

    try {
      const driveClient = await getGoogleDriveClientFromRequest(context.req);
      receiptsRepository = new GoogleDriveMonthlyExpenseReceiptsRepository(
        driveClient,
      );
    } catch (error) {
      appLogger.warn(
        "monthly-expenses SSR skipped Drive receipt status verification",
        {
          context: {
            ...requestContext,
            initialActiveTab,
            month: selectedMonth,
            operation: "monthly-expenses-ssr:skip-drive-verification",
          },
          error,
        },
      );
    }

    const getExchangeRateSnapshot = createGetMonthlyExchangeRateSnapshot(database);
    const lendersRepository = new DrizzleLendersRepository(
      database,
      userSubject,
    );

    const lendersCatalogPromise = getLendersCatalog({
      repository: lendersRepository,
    });
    const loansReportPromise =
      initialActiveTab === "debts"
        ? lendersCatalogPromise.then((catalog) =>
            getMonthlyExpensesLoansReport({
              lenders: catalog.lenders,
              repository: monthlyExpensesRepository,
            }))
        : Promise.resolve(createEmptyMonthlyExpensesLoansReportResult());

    const [documentResult, lendersResult, reportResult, copyableMonthsResult] =
      await Promise.allSettled([
        getMonthlyExpensesDocument({
          getExchangeRateSnapshot,
          query: {
            includeDriveStatuses: false,
            month: selectedMonth,
          },
          receiptsRepository,
          repository: monthlyExpensesRepository,
        }),
        lendersCatalogPromise,
        loansReportPromise,
        getMonthlyExpensesCopyableMonths({
          query: {
            targetMonth: selectedMonth,
          },
          repository: monthlyExpensesRepository,
        }),
      ]);

    if (documentResult.status === "rejected") {
      appLogger.error("monthly-expenses SSR failed to load document", {
        context: {
          ...requestContext,
          initialActiveTab,
          month: selectedMonth,
          operation: "monthly-expenses-ssr:load-document",
        },
        error: documentResult.reason,
      });
    }

    if (lendersResult.status === "rejected") {
      appLogger.error("monthly-expenses SSR failed to load lenders", {
        context: {
          ...requestContext,
          initialActiveTab,
          month: selectedMonth,
          operation: "monthly-expenses-ssr:load-lenders",
        },
        error: lendersResult.reason,
      });
    }

    if (reportResult.status === "rejected") {
      appLogger.error("monthly-expenses SSR failed to load loans report", {
        context: {
          ...requestContext,
          initialActiveTab,
          month: selectedMonth,
          operation: "monthly-expenses-ssr:load-loans-report",
        },
        error: reportResult.reason,
      });
    }

    if (copyableMonthsResult.status === "rejected") {
      appLogger.error("monthly-expenses SSR failed to load copyable months", {
        context: {
          ...requestContext,
          initialActiveTab,
          month: selectedMonth,
          operation: "monthly-expenses-ssr:load-copyable-months",
        },
        error: copyableMonthsResult.reason,
      });
    }

    return {
      props: toSerializableMonthlyExpensesPageProps({
        bootstrap,
        initialCopyableMonths:
          copyableMonthsResult.status === "fulfilled"
            ? copyableMonthsResult.value
            : createEmptyMonthlyExpensesCopyableMonthsResult(selectedMonth),
        initialActiveTab,
        initialDocument:
          documentResult.status === "fulfilled"
            ? documentResult.value
            : createEmptyMonthlyExpensesDocumentResult(selectedMonth),
        initialLendersCatalog:
          lendersResult.status === "fulfilled"
            ? lendersResult.value
            : createEmptyLendersCatalogDocumentResult(),
        initialLoansReport:
          reportResult.status === "fulfilled"
            ? reportResult.value
            : createEmptyMonthlyExpensesLoansReportResult(),
        lendersLoadErrorCode:
          lendersResult.status === "rejected"
            ? TECHNICAL_ERROR_CODES.MONTHLY_EXPENSES_SSR_LENDERS_LOAD_ERROR
            : null,
        lendersLoadError:
          lendersResult.status === "rejected"
            ? "No pudimos cargar el catálogo de prestamistas desde la base de datos."
            : null,
        loadErrorCode:
          documentResult.status === "rejected"
            ? TECHNICAL_ERROR_CODES.MONTHLY_EXPENSES_SSR_DOCUMENT_LOAD_ERROR
            : null,
        loadError:
          documentResult.status === "rejected"
            ? "No pudimos cargar el control mensual desde la base de datos. Igual podés editar la tabla y volver a guardarla."
            : null,
        reportLoadErrorCode:
          reportResult.status === "rejected"
            ? TECHNICAL_ERROR_CODES.MONTHLY_EXPENSES_SSR_REPORT_LOAD_ERROR
            : null,
        reportLoadError:
          reportResult.status === "rejected"
            ? "No pudimos cargar el reporte de deudas desde la base de datos."
            : null,
      }),
    };
  } catch (error) {
    if (isRecoverableGoogleOAuthError(error)) {
      appLogger.warn("monthly-expenses SSR skipped authenticated data", {
        context: {
          ...requestContext,
          initialActiveTab,
          month: selectedMonth,
          operation: "monthly-expenses-ssr:unauthenticated",
        },
        error,
      });
    } else {
      appLogger.error("monthly-expenses SSR request failed", {
        context: {
          ...requestContext,
          initialActiveTab,
          month: selectedMonth,
          operation: "monthly-expenses-ssr:get-server-side-props",
        },
        error,
      });
    }

    const isRecoverableAuthenticationState = isRecoverableGoogleOAuthError(error);

    return {
      props: toSerializableMonthlyExpensesPageProps({
        bootstrap,
        initialCopyableMonths:
          createEmptyMonthlyExpensesCopyableMonthsResult(selectedMonth),
        initialActiveTab,
        initialDocument: createEmptyMonthlyExpensesDocumentResult(
          selectedMonth,
        ),
        initialLendersCatalog: createEmptyLendersCatalogDocumentResult(),
        initialLoansReport: createEmptyMonthlyExpensesLoansReportResult(),
        lendersLoadErrorCode: null,
        lendersLoadError: null,
        loadErrorCode: isRecoverableAuthenticationState
          ? null
          : TECHNICAL_ERROR_CODES.MONTHLY_EXPENSES_SSR_UNEXPECTED_ERROR,
        loadError: isRecoverableAuthenticationState
          ? null
          : "No pudimos cargar el control mensual desde la base de datos. Igual podés editar la tabla y volver a guardarla.",
        reportLoadErrorCode: null,
        reportLoadError: null,
      }),
    };
  }
}
