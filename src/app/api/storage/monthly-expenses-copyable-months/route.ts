import type { NextApiHandler } from "next";
import { z } from "zod";

import { getMonthlyExpensesCopyableMonths } from "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-copyable-months";
import { DrizzleMonthlyExpensesRepository } from "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository";
import {
  appLogger,
  createRequestLogContext,
} from "@/modules/shared/infrastructure/observability/app-logger";
import { TursoConfigurationError } from "@/modules/shared/infrastructure/database/turso-server-config";
import { GoogleOAuthAuthenticationError } from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import { createAppRouteHandler } from "@/modules/shared/infrastructure/next-app/next-api-handler-adapter";

const querySchema = z.object({
  targetMonth: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

const monthlyExpensesCopyableMonthsApiHandler: NextApiHandler = async (
  request,
  response,
) => {
  const requestContext = createRequestLogContext(request);

  if (request.method !== "GET") {
    appLogger.warn("monthly-expenses-copyable-months API received an unsupported method", {
      context: {
        ...requestContext,
        operation: "monthly-expenses-copyable-months-api:method-not-allowed",
      },
    });
    response.setHeader("Allow", "GET");

    return response.status(405).json({
      error: "monthly-expenses-copyable-months only supports GET requests.",
    });
  }

  const parsedQuery = querySchema.safeParse({
    targetMonth: Array.isArray(request.query.targetMonth)
      ? request.query.targetMonth[0]
      : request.query.targetMonth,
  });

  if (!parsedQuery.success) {
    appLogger.warn("monthly-expenses-copyable-months API received an invalid target month", {
      context: {
        ...requestContext,
        operation: "monthly-expenses-copyable-months-api:invalid-query",
      },
    });

    return response.status(400).json({
      error:
        "monthly-expenses-copyable-months requires a targetMonth query parameter in YYYY-MM format.",
    });
  }

  try {
    const [{ getAuthenticatedUserSubjectFromRequest }, { createMigratedTursoDatabase }] =
      await Promise.all([
        import("@/modules/auth/infrastructure/next-auth/authenticated-user-subject"),
        import("@/modules/shared/infrastructure/database/drizzle/turso-database"),
      ]);
    const userSubject = await getAuthenticatedUserSubjectFromRequest(request);
    const database = await createMigratedTursoDatabase();
    const repository = new DrizzleMonthlyExpensesRepository(database, userSubject);

    return response.status(200).json({
      data: await getMonthlyExpensesCopyableMonths({
        query: {
          targetMonth: parsedQuery.data.targetMonth,
        },
        repository,
      }),
    });
  } catch (error) {
    appLogger.error("monthly-expenses-copyable-months API request failed", {
      context: {
        ...requestContext,
        operation: "monthly-expenses-copyable-months-api:get",
        targetMonth: parsedQuery.data.targetMonth,
      },
      error,
    });

    if (error instanceof GoogleOAuthAuthenticationError) {
      return response.status(401).json({
        error:
          "Google authentication is required before loading copyable monthly expenses months.",
      });
    }

    if (error instanceof TursoConfigurationError) {
      return response.status(500).json({
        error:
          "Database server configuration is incomplete for loading copyable monthly expenses months.",
      });
    }

    return response.status(500).json({
      error:
        "We could not load copyable monthly expenses months right now. Try again later.",
    });
  }
};

const handler = createAppRouteHandler(monthlyExpensesCopyableMonthsApiHandler);

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
