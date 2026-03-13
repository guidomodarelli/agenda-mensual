import type { NextApiRequest, NextApiResponse } from "next";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import { GoogleOAuthAuthenticationError } from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import { TursoConfigurationError } from "@/modules/shared/infrastructure/database/turso-server-config";

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
      getDatabase: jest.fn(),
      getUserSubject: jest.fn(),
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
      getDatabase: jest.fn(),
      getUserSubject: jest.fn(),
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
        "monthly-expenses requires a month in YYYY-MM format, valid expense rows, and complete loan details when a debt is included.",
    });
  });

  it("returns 201 with the saved document when the request succeeds", async () => {
    const database = {} as TursoDatabase;
    const save = jest.fn().mockResolvedValue({
      id: "monthly-expenses-file-id",
      month: "2026-03",
      name: "gastos-mensuales-2026-marzo.json",
      viewUrl: null,
    });
    const handler = createMonthlyExpensesApiHandler({
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
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
      database,
      request,
      userSubject: "google-user-123",
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: "monthly-expenses-file-id",
        month: "2026-03",
        name: "gastos-mensuales-2026-marzo.json",
        viewUrl: null,
      },
    });
  });

  it("passes loan metadata to the save use case when a debt is included", async () => {
    const database = {} as TursoDatabase;
    const save = jest.fn().mockResolvedValue({
      id: "monthly-expenses-file-id",
      month: "2026-03",
      name: "gastos-mensuales-2026-marzo.json",
      viewUrl: null,
    });
    const handler = createMonthlyExpensesApiHandler({
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save,
    });

    const request = {
      body: {
        items: [
          {
            currency: "ARS",
            description: "Prestamo tarjeta",
            id: "expense-1",
            loan: {
              installmentCount: 12,
              lenderName: "Papa",
              startMonth: "2026-01",
            },
            occurrencesPerMonth: 1,
            subtotal: 50000,
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
            description: "Prestamo tarjeta",
            id: "expense-1",
            loan: {
              installmentCount: 12,
              lenderName: "Papa",
              startMonth: "2026-01",
            },
            occurrencesPerMonth: 1,
            subtotal: 50000,
          },
        ],
        month: "2026-03",
      },
      database,
      request,
      userSubject: "google-user-123",
    });
    expect(response.statusCode).toBe(201);
  });

  it("returns 401 when Google authentication is missing", async () => {
    const handler = createMonthlyExpensesApiHandler({
      getDatabase: jest.fn(),
      getUserSubject: jest.fn().mockRejectedValue(
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
      error: "Google authentication is required before saving monthly expenses.",
    });
  });

  it("returns 500 when database configuration is missing", async () => {
    const handler = createMonthlyExpensesApiHandler({
      getDatabase: jest.fn().mockImplementation(() => {
        throw new TursoConfigurationError(
          "turso-server-config:missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN server configuration.",
        );
      }),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save: jest.fn().mockRejectedValue(
        new Error("unexpected"),
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

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error:
        "Database server configuration is incomplete for monthly expenses storage.",
    });
  });
});
