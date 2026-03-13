import type { NextApiHandler, NextApiRequest } from "next";
import { z } from "zod";

import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";
import { TursoConfigurationError } from "@/modules/shared/infrastructure/database/turso-server-config";

const lenderSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  notes: z.string().optional(),
  type: z.enum(["bank", "family", "friend", "other"]),
});

const lendersRequestBodySchema = z.object({
  lenders: z.array(lenderSchema),
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

export function createLendersApiHandler<TGetResult, TSaveResult>({
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
    command: z.infer<typeof lendersRequestBodySchema>;
    database: TursoDatabase;
    request: NextApiRequest;
    userSubject: string;
  }) => Promise<TSaveResult>;
}): NextApiHandler {
  return async function lendersApiHandler(request, response) {
    if (request.method !== "GET" && request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");

      return response.status(405).json({
        error: "lenders only supports GET and POST requests on this endpoint.",
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

      const parsedBody = lendersRequestBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return response.status(400).json({
          error:
            "lenders requires a JSON body with unique lenders, valid types, and non-empty ids and names.",
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
      if (error instanceof GoogleOAuthAuthenticationError) {
        return response.status(401).json({
          error:
            "Google authentication is required before reading or saving lenders.",
        });
      }

      if (error instanceof GoogleOAuthConfigurationError) {
        return response.status(500).json({
          error:
            "Google OAuth server configuration is incomplete for lenders storage.",
        });
      }

      if (error instanceof TursoConfigurationError) {
        return response.status(500).json({
          error: "Database server configuration is incomplete for lenders storage.",
        });
      }

      if (error instanceof Error) {
        return response.status(400).json({
          error: error.message,
        });
      }

      return response.status(500).json({
        error: "We could not manage lenders right now. Try again later.",
      });
    }
  };
}
