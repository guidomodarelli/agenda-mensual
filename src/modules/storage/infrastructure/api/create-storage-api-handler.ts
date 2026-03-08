import type { NextApiHandler, NextApiRequest } from "next";
import type { drive_v3 } from "googleapis";
import { z } from "zod";

import {
  GoogleOAuthAuthenticationError,
  GoogleOAuthConfigurationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";

import { GoogleDriveStorageError } from "../google-drive/google-drive-storage-error";

const storageRequestBodySchema = z.object({
  content: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

export interface StorageApiCommand {
  content: string;
  mimeType: string;
  name: string;
}

async function getDefaultDriveClient(request: NextApiRequest) {
  const { getGoogleDriveClientFromRequest } = await import(
    "@/modules/auth/infrastructure/google-drive/google-drive-client"
  );

  return getGoogleDriveClientFromRequest(request);
}

export function createStorageApiHandler<TResult>({
  getDriveClient = getDefaultDriveClient,
  operationLabel,
  save,
}: {
  getDriveClient?: (
    request: NextApiRequest,
  ) => Promise<drive_v3.Drive>;
  operationLabel: string;
  save: (dependencies: {
    command: StorageApiCommand;
    driveClient: drive_v3.Drive;
    request: NextApiRequest;
  }) => Promise<TResult>;
}): NextApiHandler {
  return async function storageApiHandler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");

      return response.status(405).json({
        error: `storage:${operationLabel} only supports POST requests on this endpoint.`,
      });
    }

    const parsedBody = storageRequestBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return response.status(400).json({
        error: `storage:${operationLabel} requires a JSON body with non-empty string values for name, mimeType, and content.`,
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
          error: `Google authentication is required before saving ${operationLabel} to Drive.`,
        });
      }

      if (error instanceof GoogleOAuthConfigurationError) {
        return response.status(500).json({
          error: `Google OAuth server configuration is incomplete for ${operationLabel} Drive storage.`,
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
            error: `The current Google session is missing the Drive permissions required to save ${operationLabel}. Sign out, connect Google again, and approve Drive access.`,
          });
        }

        if (error.code === "insufficient_permissions") {
          return response.status(403).json({
            error: `Google Drive denied permission to save ${operationLabel}. Verify the selected Google account can create Drive files and try again.`,
          });
        }

        if (error.code === "invalid_payload") {
          return response.status(400).json({
            error: `Google Drive rejected the ${operationLabel} payload. Check the file name, MIME type, and content and try again.`,
          });
        }
      }

      return response.status(500).json({
        error: `We could not save ${operationLabel} to Google Drive. Try again later.`,
      });
    }
  };
}
