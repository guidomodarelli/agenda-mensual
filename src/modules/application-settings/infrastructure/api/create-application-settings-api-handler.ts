import type { NextApiHandler, NextApiRequest } from "next";
import { z } from "zod";

import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";
import { TursoConfigurationError } from "@/modules/shared/infrastructure/database/turso-server-config";

const applicationSettingsRequestBodySchema = z.object({
  content: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  name: z.string().trim().min(1),
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

export function createApplicationSettingsApiHandler<TResult>({
  getDatabase = getDefaultDatabase,
  getUserSubject = getDefaultUserSubject,
  save,
}: {
  getDatabase?: () => Promise<TursoDatabase> | TursoDatabase;
  getUserSubject?: (request: NextApiRequest) => Promise<string>;
  save: (dependencies: {
    command: z.infer<typeof applicationSettingsRequestBodySchema>;
    database: TursoDatabase;
    request: NextApiRequest;
    userSubject: string;
  }) => Promise<TResult>;
}): NextApiHandler {
  return async function applicationSettingsApiHandler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");

      return response.status(405).json({
        error:
          "application-settings only supports POST requests on this endpoint.",
      });
    }

    const parsedBody = applicationSettingsRequestBodySchema.safeParse(
      request.body,
    );

    if (!parsedBody.success) {
      return response.status(400).json({
        error:
          "application-settings requires a JSON body with non-empty string values for name, mimeType, and content.",
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
            "Google authentication is required before saving application settings.",
        });
      }

      if (error instanceof GoogleOAuthConfigurationError) {
        return response.status(500).json({
          error:
            "Google OAuth server configuration is incomplete for application settings storage.",
        });
      }

      if (error instanceof TursoConfigurationError) {
        return response.status(500).json({
          error:
            "Database server configuration is incomplete for application settings storage.",
        });
      }

      if (error instanceof Error) {
        return response.status(400).json({
          error: error.message,
        });
      }

      return response.status(500).json({
        error:
          "We could not save application settings right now. Try again later.",
      });
    }
  };
}
