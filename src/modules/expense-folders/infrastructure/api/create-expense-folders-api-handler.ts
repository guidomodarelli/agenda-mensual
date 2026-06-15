import type { NextApiHandler, NextApiRequest } from "next";
import { z } from "zod";

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
import {
  EXPENSE_FOLDER_COLORS,
  EXPENSE_FOLDER_ICONS,
  ExpenseFoldersCatalogValidationError,
} from "@/modules/expense-folders/domain/value-objects/expense-folders-catalog-document";

const expenseFolderSchema = z.object({
  color: z.enum(EXPENSE_FOLDER_COLORS).nullish(),
  icon: z.enum(EXPENSE_FOLDER_ICONS).nullish(),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  position: z.number().int().min(0).optional(),
});

const expenseFoldersRequestBodySchema = z.object({
  folders: z.array(expenseFolderSchema),
});

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

export function createExpenseFoldersApiHandler<TGetResult, TSaveResult>({
  get,
  getDatabase = getDefaultDatabase,
  getUserSubject = getDefaultUserSubject,
  save,
}: {
  get: (dependencies: {
    database: TursoDatabase;
    userSubject: string;
  }) => Promise<TGetResult>;
  getDatabase?: () => Promise<TursoDatabase> | TursoDatabase;
  getUserSubject?: (request: NextApiRequest) => Promise<string>;
  save: (dependencies: {
    command: z.infer<typeof expenseFoldersRequestBodySchema>;
    database: TursoDatabase;
    request: NextApiRequest;
    userSubject: string;
  }) => Promise<TSaveResult>;
}): NextApiHandler {
  return async function expenseFoldersApiHandler(request, response) {
    const requestContext = createRequestLogContext(request);

    if (request.method !== "GET" && request.method !== "POST") {
      appLogger.warn("expense folders API received an unsupported method", {
        context: {
          ...requestContext,
          operation: "expense-folders-api:method-not-allowed",
        },
      });

      response.setHeader("Allow", "GET, POST");

      return response.status(405).json({
        error:
          "expense folders only supports GET and POST requests on this endpoint.",
      });
    }

    try {
      const userSubject = await getUserSubject(request);
      const database = await getDatabase();

      if (request.method === "GET") {
        return response.status(200).json({
          data: await get({ database, userSubject }),
        });
      }

      const parsedBody = expenseFoldersRequestBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        appLogger.warn("expense folders API received an invalid payload", {
          context: {
            ...requestContext,
            operation: "expense-folders-api:post:invalid-payload",
          },
        });

        return response.status(400).json({
          error:
            "expense folders requires a JSON body with unique folders, valid colors and icons, and non-empty ids and names.",
        });
      }

      return response.status(201).json({
        data: await save({
          command: parsedBody.data,
          database,
          request,
          userSubject,
        }),
      });
    } catch (error) {
      appLogger.error("expense folders API request failed", {
        context: {
          ...requestContext,
          operation:
            request.method === "GET"
              ? "expense-folders-api:get"
              : "expense-folders-api:post",
        },
        error,
      });

      if (error instanceof GoogleOAuthAuthenticationError) {
        return response.status(401).json({
          ...createTechnicalErrorEnvelope(
            "Google authentication is required before reading or saving expense folders.",
            TECHNICAL_ERROR_CODES.GOOGLE_AUTHENTICATION_REQUIRED,
          ),
        });
      }

      if (error instanceof GoogleOAuthConfigurationError) {
        return response.status(500).json({
          ...createTechnicalErrorEnvelope(
            "Google OAuth server configuration is incomplete for expense folders storage.",
            TECHNICAL_ERROR_CODES.GOOGLE_OAUTH_CONFIGURATION_INCOMPLETE,
          ),
        });
      }

      if (error instanceof TursoConfigurationError) {
        return response.status(500).json({
          ...createTechnicalErrorEnvelope(
            "Database server configuration is incomplete for expense folders storage.",
            TECHNICAL_ERROR_CODES.TURSO_CONFIGURATION_INCOMPLETE,
          ),
        });
      }

      // Known catalog validation failures on a write are client-correctable, so
      // they keep returning a 4xx with the validation message. The same error on
      // a GET means stored data is corrupt, which is a server problem and falls
      // through to the cataloged technical envelope below.
      if (
        error instanceof ExpenseFoldersCatalogValidationError &&
        request.method === "POST"
      ) {
        return response.status(400).json({
          error: error.message,
        });
      }

      return response.status(500).json({
        ...createTechnicalErrorEnvelope(
          "We could not manage expense folders right now. Try again later.",
          TECHNICAL_ERROR_CODES.EXPENSE_FOLDERS_API_UNEXPECTED_ERROR,
        ),
      });
    }
  };
}
