import type { NextApiHandler, NextApiRequest } from "next";

import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";
import { TursoConfigurationError } from "@/modules/shared/infrastructure/database/turso-server-config";
import {
  appLogger,
  createRequestLogContext,
} from "@/modules/shared/infrastructure/observability/app-logger";
import {
  TECHNICAL_ERROR_CODES,
} from "@/modules/shared/infrastructure/errors/technical-error-codes";
import {
  createTechnicalErrorEnvelope,
} from "@/modules/shared/infrastructure/errors/technical-error";

async function getDefaultUserSubject(request: NextApiRequest) {
  const { getAuthenticatedUserSubjectFromRequest } = await import(
    "@/modules/auth/infrastructure/next-auth/authenticated-user-subject"
  );

  return getAuthenticatedUserSubjectFromRequest(request);
}

async function getDefaultDatabase(): Promise<TursoDatabase> {
  const { createMigratedTursoDatabase } = await import(
    "@/modules/shared/infrastructure/database/drizzle/turso-database"
  );

  return createMigratedTursoDatabase();
}

export function createMonthlyExpensesLoansReportApiHandler<TResult>({
  getDatabase = getDefaultDatabase,
  getUserSubject = getDefaultUserSubject,
  load,
}: {
  getDatabase?: () => Promise<TursoDatabase> | TursoDatabase;
  getUserSubject?: (request: NextApiRequest) => Promise<string>;
  load: (dependencies: {
    database: TursoDatabase;
    userSubject: string;
  }) => Promise<TResult>;
}): NextApiHandler {
  return async function monthlyExpensesLoansReportApiHandler(request, response) {
    const requestContext = createRequestLogContext(request);

    if (request.method !== "GET") {
      appLogger.warn(
        "monthly-expenses-report API received an unsupported method",
        {
          context: {
            ...requestContext,
            operation: "monthly-expenses-report-api:method-not-allowed",
          },
        },
      );

      response.setHeader("Allow", "GET");

      return response.status(405).json({
        error:
          "monthly-expenses-report only supports GET requests on this endpoint.",
      });
    }

    try {
      const userSubject = await getUserSubject(request);
      const database = await getDatabase();

      return response.status(200).json({
        data: await load({ database, userSubject }),
      });
    } catch (error) {
      appLogger.error("monthly-expenses-report API request failed", {
        context: {
          ...requestContext,
          operation: "monthly-expenses-report-api:get",
        },
        error,
      });

      if (error instanceof GoogleOAuthAuthenticationError) {
        return response.status(401).json({
          ...createTechnicalErrorEnvelope(
            "Google authentication is required before loading monthly expenses reports.",
            TECHNICAL_ERROR_CODES.GOOGLE_AUTHENTICATION_REQUIRED,
          ),
        });
      }

      if (error instanceof GoogleOAuthConfigurationError) {
        return response.status(500).json({
          ...createTechnicalErrorEnvelope(
            "Google OAuth server configuration is incomplete for monthly expenses report loading.",
            TECHNICAL_ERROR_CODES.GOOGLE_OAUTH_CONFIGURATION_INCOMPLETE,
          ),
        });
      }

      if (error instanceof TursoConfigurationError) {
        return response.status(500).json({
          ...createTechnicalErrorEnvelope(
            "Database server configuration is incomplete for monthly expenses report loading.",
            TECHNICAL_ERROR_CODES.TURSO_CONFIGURATION_INCOMPLETE,
          ),
        });
      }

      if (error instanceof Error) {
        // Carry the technical error code so the client (the only loader of the
        // deferred debts report) can surface an E#### code, matching the coded
        // SSR failure path this deferral replaced.
        return response.status(400).json({
          ...createTechnicalErrorEnvelope(
            error.message,
            TECHNICAL_ERROR_CODES.MONTHLY_EXPENSES_REPORT_API_UNEXPECTED_ERROR,
          ),
        });
      }

      return response.status(500).json({
        ...createTechnicalErrorEnvelope(
          "We could not load the monthly expenses report right now. Try again later.",
          TECHNICAL_ERROR_CODES.MONTHLY_EXPENSES_REPORT_API_UNEXPECTED_ERROR,
        ),
      });
    }
  };
}
