import type { NextApiRequest, NextApiResponse } from "next";
import type { drive_v3 } from "googleapis";

import { GoogleOAuthAuthenticationError } from "@/modules/auth/infrastructure/oauth/google-oauth-token";

import { GoogleDriveStorageError } from "../google-drive/google-drive-storage-error";
import { createStorageApiHandler } from "./create-storage-api-handler";

interface MockJsonResponse {
  body: unknown | undefined;
  headers: Record<string, string>;
  statusCode: number;
}

function createMockResponse(): NextApiResponse & MockJsonResponse {
  const response: MockJsonResponse & {
    json(payload: unknown): MockJsonResponse;
    setHeader(name: string, value: string): MockJsonResponse;
    status(code: number): MockJsonResponse;
  } = {
    body: undefined,
    headers: {},
    json(payload: unknown) {
      response.body = payload;
      return response;
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value;
      return response;
    },
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    statusCode: 200,
  };

  return response as unknown as NextApiResponse & MockJsonResponse;
}

describe("createStorageApiHandler", () => {
  it("rejects methods other than POST", async () => {
    const getDriveClient = jest.fn();
    const save = jest.fn();
    const handler = createStorageApiHandler({
      getDriveClient,
      operationLabel: "application settings",
      save,
    });

    const request = {
      body: {},
      method: "GET",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.headers).toEqual({ Allow: "POST" });
    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({
      error:
        "storage:application settings only supports POST requests on this endpoint.",
    });
    expect(getDriveClient).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is invalid", async () => {
    const handler = createStorageApiHandler({
      getDriveClient: jest.fn(),
      operationLabel: "application settings",
      save: jest.fn(),
    });

    const request = {
      body: {
        content: "  ",
        mimeType: "application/json",
        name: "",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error:
        "storage:application settings requires a JSON body with non-empty string values for name, mimeType, and content.",
    });
  });

  it("returns 401 when Google authentication is missing", async () => {
    const handler = createStorageApiHandler({
      getDriveClient: jest.fn().mockRejectedValue(
        new GoogleOAuthAuthenticationError(
          "google-drive-client:getGoogleSessionTokenFromRequest requires an authenticated NextAuth session.",
        ),
      ),
      operationLabel: "application settings",
      save: jest.fn(),
    });

    const request = {
      body: {
        content: "{\"theme\":\"dark\"}",
        mimeType: "application/json",
        name: "application-settings.json",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      error:
        "Google authentication is required before saving application settings to Drive.",
    });
  });

  it("returns 201 with the saved payload when the request succeeds", async () => {
    const driveClient = {} as drive_v3.Drive;
    const save = jest.fn().mockResolvedValue({
      id: "settings-file-id",
      mimeType: "application/json",
      name: "application-settings.json",
    });
    const handler = createStorageApiHandler({
      getDriveClient: jest.fn().mockResolvedValue(driveClient),
      operationLabel: "application settings",
      save,
    });

    const request = {
      body: {
        content: "{\"theme\":\"dark\"}",
        mimeType: "application/json",
        name: "application-settings.json",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(save).toHaveBeenCalledWith({
      command: {
        content: "{\"theme\":\"dark\"}",
        mimeType: "application/json",
        name: "application-settings.json",
      },
      driveClient,
      request,
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: "settings-file-id",
        mimeType: "application/json",
        name: "application-settings.json",
      },
    });
  });

  it("returns 500 when Drive storage fails unexpectedly", async () => {
    const handler = createStorageApiHandler({
      getDriveClient: jest.fn().mockResolvedValue({} as drive_v3.Drive),
      operationLabel: "application settings",
      save: jest.fn().mockRejectedValue(
        new Error(
          "storage:application settings could not persist the Google Drive file.",
        ),
      ),
    });

    const request = {
      body: {
        content: "{\"theme\":\"dark\"}",
        mimeType: "application/json",
        name: "application-settings.json",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error:
        "We could not save application settings to Google Drive. Try again later.",
    });
  });

  it("returns 503 when Google Drive API is disabled", async () => {
    const handler = createStorageApiHandler({
      getDriveClient: jest.fn().mockResolvedValue({} as drive_v3.Drive),
      operationLabel: "user files",
      save: jest.fn().mockRejectedValue(
        new GoogleDriveStorageError(
          "google-drive-user-files-repository:save failed while calling drive.files.create with httpStatus=403 and apiStatus=SERVICE_DISABLED.",
          {
            code: "api_disabled",
            endpoint: "drive.files.create",
            httpStatus: 403,
            operation: "google-drive-user-files-repository:save",
          },
        ),
      ),
    });

    const request = {
      body: {
        content: "date,amount\n2026-03-08,32.5",
        mimeType: "text/csv",
        name: "expenses.csv",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({
      error:
        "Google Drive API is not enabled for this project yet. Enable drive.googleapis.com in Google Cloud and try again.",
    });
  });

  it("returns 403 when the Google session is missing Drive scopes", async () => {
    const handler = createStorageApiHandler({
      getDriveClient: jest.fn().mockResolvedValue({} as drive_v3.Drive),
      operationLabel: "user files",
      save: jest.fn().mockRejectedValue(
        new GoogleDriveStorageError(
          "google-drive-user-files-repository:save failed while calling drive.files.create with httpStatus=403 and apiStatus=PERMISSION_DENIED.",
          {
            code: "invalid_scope",
            endpoint: "drive.files.create",
            httpStatus: 403,
            operation: "google-drive-user-files-repository:save",
          },
        ),
      ),
    });

    const request = {
      body: {
        content: "date,amount\n2026-03-08,32.5",
        mimeType: "text/csv",
        name: "expenses.csv",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      error:
        "The current Google session is missing the Drive permissions required to save user files. Sign out, connect Google again, and approve Drive access.",
    });
  });

  it("returns 400 when Google Drive rejects the payload", async () => {
    const handler = createStorageApiHandler({
      getDriveClient: jest.fn().mockResolvedValue({} as drive_v3.Drive),
      operationLabel: "user files",
      save: jest.fn().mockRejectedValue(
        new GoogleDriveStorageError(
          "google-drive-user-files-repository:save failed while calling drive.files.create with httpStatus=400 and apiStatus=INVALID_ARGUMENT.",
          {
            code: "invalid_payload",
            endpoint: "drive.files.create",
            httpStatus: 400,
            operation: "google-drive-user-files-repository:save",
          },
        ),
      ),
    });

    const request = {
      body: {
        content: "date,amount\n2026-03-08,32.5",
        mimeType: "text/csv",
        name: "expenses.csv",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error:
        "Google Drive rejected the user files payload. Check the file name, MIME type, and content and try again.",
    });
  });
});
