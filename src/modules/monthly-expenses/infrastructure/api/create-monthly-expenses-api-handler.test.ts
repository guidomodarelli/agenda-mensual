import type { NextApiRequest, NextApiResponse } from "next";
import type { drive_v3 } from "googleapis";

import { GoogleOAuthAuthenticationError } from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import { GoogleDriveStorageError } from "@/modules/storage/infrastructure/google-drive/google-drive-storage-error";

import { createMonthlyExpensesApiHandler } from "./create-monthly-expenses-api-handler";

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

describe("createMonthlyExpensesApiHandler", () => {
  it("rejects methods other than POST", async () => {
    const handler = createMonthlyExpensesApiHandler({
      getDriveClient: jest.fn(),
      save: jest.fn(),
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
      error: "monthly-expenses only supports POST requests on this endpoint.",
    });
  });

  it("returns 400 when the request body is invalid", async () => {
    const handler = createMonthlyExpensesApiHandler({
      getDriveClient: jest.fn(),
      save: jest.fn(),
    });

    const request = {
      body: {
        items: [
          {
            currency: "ARS",
            description: "  ",
            id: "expense-1",
            occurrencesPerMonth: 0,
            subtotal: 0,
          },
        ],
        month: "03-2026",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error:
        "monthly-expenses requires a month in YYYY-MM format and items with description, currency, subtotal, and occurrences per month.",
    });
  });

  it("returns 201 with the saved document when the request succeeds", async () => {
    const driveClient = {} as drive_v3.Drive;
    const save = jest.fn().mockResolvedValue({
      id: "monthly-expenses-file-id",
      month: "2026-03",
      name: "monthly-expenses-2026-03.json",
      viewUrl: "https://drive.google.com/file/d/monthly-expenses-file-id/view",
    });
    const handler = createMonthlyExpensesApiHandler({
      getDriveClient: jest.fn().mockResolvedValue(driveClient),
      save,
    });

    const request = {
      body: {
        items: [
          {
            currency: "ARS",
            description: "Expensas",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 55032.07,
          },
        ],
        month: "2026-03",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(save).toHaveBeenCalledWith({
      command: {
        items: [
          {
            currency: "ARS",
            description: "Expensas",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 55032.07,
          },
        ],
        month: "2026-03",
      },
      driveClient,
      request,
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: "monthly-expenses-file-id",
        month: "2026-03",
        name: "monthly-expenses-2026-03.json",
        viewUrl: "https://drive.google.com/file/d/monthly-expenses-file-id/view",
      },
    });
  });

  it("returns 401 when Google authentication is missing", async () => {
    const handler = createMonthlyExpensesApiHandler({
      getDriveClient: jest.fn().mockRejectedValue(
        new GoogleOAuthAuthenticationError(
          "google-drive-client:getGoogleSessionTokenFromRequest requires an authenticated NextAuth session.",
        ),
      ),
      save: jest.fn(),
    });

    const request = {
      body: {
        items: [
          {
            currency: "ARS",
            description: "Agua",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 10774.53,
          },
        ],
        month: "2026-03",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      error:
        "Google authentication is required before saving monthly expenses to Drive.",
    });
  });

  it("returns 400 when Google Drive rejects the payload", async () => {
    const handler = createMonthlyExpensesApiHandler({
      getDriveClient: jest.fn().mockResolvedValue({} as drive_v3.Drive),
      save: jest.fn().mockRejectedValue(
        new GoogleDriveStorageError(
          "google-drive-monthly-expenses-repository:save failed while calling drive.files.create with httpStatus=400 and apiStatus=INVALID_ARGUMENT.",
          {
            code: "invalid_payload",
            endpoint: "drive.files.create",
            httpStatus: 400,
            operation: "google-drive-monthly-expenses-repository:save",
          },
        ),
      ),
    });

    const request = {
      body: {
        items: [
          {
            currency: "ARS",
            description: "Agua",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 10774.53,
          },
        ],
        month: "2026-03",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error:
        "Google Drive rejected the monthly expenses payload. Check the month, rows, and numeric values and try again.",
    });
  });
});
