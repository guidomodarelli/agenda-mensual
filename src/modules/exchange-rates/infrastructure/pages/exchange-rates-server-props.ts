import type { GetServerSidePropsContext } from "next";

import {
  getAuthenticatedUserEmailFromRequest,
} from "@/modules/auth/infrastructure/next-auth/authenticated-user-email";
import {
  isGoogleAdminEmail,
} from "@/modules/auth/infrastructure/next-auth/google-admin-allowlist";
import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import { GOOGLE_OAUTH_SCOPES } from "@/modules/auth/infrastructure/oauth/google-oauth-scopes";
import {
  createMigratedTursoDatabase,
} from "@/modules/shared/infrastructure/database/drizzle/turso-database";
import {
  appLogger,
  createRequestLogContext,
} from "@/modules/shared/infrastructure/observability/app-logger";
import {
  TECHNICAL_ERROR_CODES,
  type TechnicalErrorCode,
} from "@/modules/shared/infrastructure/errors/technical-error-codes";
import { getStorageBootstrap } from "@/modules/storage/application/queries/get-storage-bootstrap";
import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";

import type { ExchangeRatesPageResult } from "../../application/results/exchange-rates-page-result";
import {
  getExchangeRatesPageResult,
} from "../../application/use-cases/get-exchange-rates-page-result";
import { DEFAULT_IIBB_RATE_DECIMAL } from "../../application/use-cases/get-monthly-exchange-rate-snapshot";
import { DrizzleMonthlyExpensesRepository } from "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository";
import { AmbitoExchangeRatesRepository } from "../api/ambito-exchange-rates-repository";
import { DrizzleGlobalExchangeRateSettingsRepository } from "../turso/repositories/drizzle-global-exchange-rate-settings-repository";
import { DrizzleMonthlyExchangeRateSnapshotsRepository } from "../turso/repositories/drizzle-monthly-exchange-rate-snapshots-repository";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function getCurrentMonthIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function isFutureMonth(month: string, currentMonth: string): boolean {
  return month > currentMonth;
}

function getRequestedMonth(
  queryValue: GetServerSidePropsContext["query"]["month"],
  currentMonth: string,
): string {
  const monthValue = Array.isArray(queryValue) ? queryValue[0] : queryValue;
  const normalizedMonth = monthValue?.trim();

  if (!normalizedMonth || !MONTH_PATTERN.test(normalizedMonth)) {
    return currentMonth;
  }

  return isFutureMonth(normalizedMonth, currentMonth)
    ? currentMonth
    : normalizedMonth;
}

export interface ExchangeRatesRoutePageProps {
  bootstrap: StorageBootstrapResult;
  result: ExchangeRatesPageResult;
}

function createFallbackExchangeRatesPageResult(
  canEditIibb: boolean,
  loadError: string,
  loadErrorCode: TechnicalErrorCode,
  maxSelectableMonth: string,
  minSelectableMonth: string,
  selectedMonth: string,
): ExchangeRatesPageResult {
  return {
    blueRate: 0,
    canEditIibb,
    iibbRateDecimal: DEFAULT_IIBB_RATE_DECIMAL,
    loadErrorCode,
    loadError,
    maxSelectableMonth,
    minSelectableMonth,
    officialRate: 0,
    selectedMonth,
    solidarityRate: 0,
  };
}

async function getCanEditIibb(context: GetServerSidePropsContext): Promise<boolean> {
  try {
    const userEmail = await getAuthenticatedUserEmailFromRequest(context.req);

    return isGoogleAdminEmail(userEmail);
  } catch {
    return false;
  }
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

export async function getExchangeRatesServerSideProps(
  context: GetServerSidePropsContext,
): Promise<{ props: ExchangeRatesRoutePageProps }> {
  const currentMonth = getCurrentMonthIdentifier();
  const selectedMonth = getRequestedMonth(context.query.month, currentMonth);
  const requestContext = createRequestLogContext(context.req);
  const bootstrap = getStorageBootstrap({
    isGoogleOAuthConfigured: isGoogleOAuthConfigured(),
    requiredScopes: GOOGLE_OAUTH_SCOPES,
  });
  const canEditIibb = await getCanEditIibb(context);

  try {
    const database = await createMigratedTursoDatabase();
    const settingsRepository = new DrizzleGlobalExchangeRateSettingsRepository(
      database,
    );
    const exchangeRatesRepository = new AmbitoExchangeRatesRepository();
    const monthlyExchangeRateSnapshotsRepository =
      new DrizzleMonthlyExchangeRateSnapshotsRepository(database);
    let minSelectableMonth = currentMonth;

    try {
      const { getAuthenticatedUserSubjectFromRequest } = await import(
        "@/modules/auth/infrastructure/next-auth/authenticated-user-subject"
      );
      const userSubject = await getAuthenticatedUserSubjectFromRequest(context.req);
      const oldestStoredMonth =
        await new DrizzleMonthlyExpensesRepository(
          database,
          userSubject,
        ).getOldestStoredMonth();

      minSelectableMonth = oldestStoredMonth ?? currentMonth;
    } catch (error) {
      if (!isRecoverableGoogleOAuthError(error)) {
        throw error;
      }

      appLogger.warn("exchange-rates SSR skipped user month range", {
        context: {
          ...requestContext,
          month: selectedMonth,
          operation: "exchange-rates-ssr:skip-user-month-range",
        },
        error,
      });
    }

    return {
      props: {
        bootstrap,
        result: await getExchangeRatesPageResult({
          canEditIibb,
          exchangeRatesRepository,
          maxSelectableMonth: currentMonth,
          minSelectableMonth,
          month: selectedMonth,
          monthlyExchangeRateSnapshotsRepository,
          settingsRepository,
        }),
      },
    };
  } catch (error) {
    appLogger.error("exchange-rates SSR request failed", {
      context: {
        ...requestContext,
        operation: "exchange-rates-ssr:get-server-side-props",
      },
      error,
    });

    return {
      props: {
        bootstrap,
        result: createFallbackExchangeRatesPageResult(
          canEditIibb,
          "No pudimos cargar las cotizaciones del dólar en este momento.",
          TECHNICAL_ERROR_CODES.EXCHANGE_RATES_SSR_UNEXPECTED_ERROR,
          currentMonth,
          currentMonth,
          selectedMonth,
        ),
      },
    };
  }
}
