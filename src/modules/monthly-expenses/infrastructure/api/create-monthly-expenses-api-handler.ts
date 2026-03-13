import type { NextApiHandler, NextApiRequest } from "next";
import { z } from "zod";

import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";
import { TursoConfigurationError } from "@/modules/shared/infrastructure/database/turso-server-config";

import type { SaveMonthlyExpensesCommand } from "../../application/commands/save-monthly-expenses-command";

const monthlyExpenseItemSchema = z.object({
  currency: z.enum(["ARS", "USD"]),
  description: z.string().trim().min(1),
  id: z.string().trim().min(1),
  loan: z
    .object({
      installmentCount: z.number().int().positive(),
      lenderId: z.string().optional(),
      lenderName: z.string().optional(),
      startMonth: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    })
    .optional(),
  occurrencesPerMonth: z.number().int().positive(),
  subtotal: z.number().positive(),
});

const monthlyExpensesRequestBodySchema = z.object({
  items: z.array(monthlyExpenseItemSchema),
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

async function getDefaultUserSubject(request: NextApiRequest) {
  const { getAuthenticatedUserSubjectFromRequest } = await import(
    "@/modules/auth/infrastructure/next-auth/authenticated-user-subject"
  );

  return getAuthenticatedUserSubjectFromRequest(request);
}

async function getDefaultDatabase(): Promise<TursoDatabase> {
  const { createTursoDatabase } = await import(
    "@/modules/shared/infrastructure/database/drizzle/turso-database"
  );

  return createTursoDatabase();
}

export function createMonthlyExpensesApiHandler<TResult>({
  getDatabase = getDefaultDatabase,
  getUserSubject = getDefaultUserSubject,
  save,
}: {
  getDatabase?: () => Promise<TursoDatabase> | TursoDatabase;
  getUserSubject?: (request: NextApiRequest) => Promise<string>;
  save: (dependencies: {
    command: SaveMonthlyExpensesCommand;
    database: TursoDatabase;
    request: NextApiRequest;
    userSubject: string;
  }) => Promise<TResult>;
}): NextApiHandler {
  return async function monthlyExpensesApiHandler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");

      return response.status(405).json({
        error: "monthly-expenses only supports POST requests on this endpoint.",
      });
    }

    const parsedBody = monthlyExpensesRequestBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return response.status(400).json({
        error:
          "monthly-expenses requires a month in YYYY-MM format, valid expense rows, and complete loan details when a debt is included.",
      });
    }

    try {
      const userSubject = await getUserSubject(request);
      const database = await getDatabase();
      const result = await save({
        command: parsedBody.data,
        database,
        request,
        userSubject,
      });

      return response.status(201).json({
        data: result,
      });
    } catch (error) {
      if (error instanceof GoogleOAuthAuthenticationError) {
        return response.status(401).json({
          error:
            "Google authentication is required before saving monthly expenses.",
        });
      }

      if (error instanceof GoogleOAuthConfigurationError) {
        return response.status(500).json({
          error:
            "Google OAuth server configuration is incomplete for monthly expenses storage.",
        });
      }

      if (error instanceof TursoConfigurationError) {
        return response.status(500).json({
          error:
            "Database server configuration is incomplete for monthly expenses storage.",
        });
      }

      return response.status(500).json({
        error: "We could not save monthly expenses right now. Try again later.",
      });
    }
  };
}
