import type { NextApiHandler, NextApiRequest } from "next";
import type { drive_v3 } from "googleapis";
import { z } from "zod";

import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import { GoogleDriveStorageError } from "@/modules/storage/infrastructure/google-drive/google-drive-storage-error";

import type { SaveMonthlyExpensesCommand } from "../../application/commands/save-monthly-expenses-command";

const monthlyExpenseItemSchema = z.object({
  currency: z.enum(["ARS", "USD"]),
  description: z.string().trim().min(1),
  id: z.string().trim().min(1),
  occurrencesPerMonth: z.number().int().positive(),
  subtotal: z.number().positive(),
});

const monthlyExpensesRequestBodySchema = z.object({
  items: z.array(monthlyExpenseItemSchema),
  month: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

async function getDefaultDriveClient(request: NextApiRequest) {
  const { getGoogleDriveClientFromRequest } = await import(
    "@/modules/auth/infrastructure/google-drive/google-drive-client"
  );

  return getGoogleDriveClientFromRequest(request);
}

export function createMonthlyExpensesApiHandler<TResult>({
  getDriveClient = getDefaultDriveClient,
  save,
}: {
  getDriveClient?: (request: NextApiRequest) => Promise<drive_v3.Drive>;
  save: (dependencies: {
    command: SaveMonthlyExpensesCommand;
    driveClient: drive_v3.Drive;
    request: NextApiRequest;
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
          "monthly-expenses requires a month in YYYY-MM format and items with description, currency, subtotal, and occurrences per month.",
      });
    }

    try {
      const driveClient = await getDriveClient(request);
      const result = await save({
        command: parsedBody.data,
        driveClient,
        request,
      });

      return response.status(201).json({
        data: result,
      });
    } catch (error) {
      if (error instanceof GoogleOAuthAuthenticationError) {
        return response.status(401).json({
          error:
            "Google authentication is required before saving monthly expenses to Drive.",
        });
      }

      if (error instanceof GoogleOAuthConfigurationError) {
        return response.status(500).json({
          error:
            "Google OAuth server configuration is incomplete for monthly expenses Drive storage.",
        });
      }

      if (error instanceof GoogleDriveStorageError) {
        if (error.code === "api_disabled") {
          return response.status(503).json({
            error:
              "Google Drive API is not enabled for this project yet. Enable drive.googleapis.com in Google Cloud and try again.",
          });
        }

        if (error.code === "invalid_scope") {
          return response.status(403).json({
            error:
              "The current Google session is missing the Drive permissions required to save monthly expenses. Sign out, connect Google again, and approve Drive access.",
          });
        }

        if (error.code === "insufficient_permissions") {
          return response.status(403).json({
            error:
              "Google Drive denied permission to save monthly expenses. Verify the selected Google account can create Drive files and try again.",
          });
        }

        if (error.code === "invalid_payload") {
          return response.status(400).json({
            error:
              "Google Drive rejected the monthly expenses payload. Check the month, rows, and numeric values and try again.",
          });
        }
      }

      return response.status(500).json({
        error: "We could not save monthly expenses to Google Drive. Try again later.",
      });
    }
  };
}
