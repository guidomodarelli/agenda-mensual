import type { NextApiRequest, NextApiResponse } from "next";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import { createLendersApiHandler } from "./create-lenders-api-handler";

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

describe("createLendersApiHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("returns 200 with the lenders catalog when the request is GET", async () => {
    const database = {} as TursoDatabase;
    const handler = createLendersApiHandler({
      get: jest.fn().mockResolvedValue({
        lenders: [
          {
            id: "lender-1",
            name: "Banco Galicia",
            type: "bank",
          },
        ],
      }),
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save: jest.fn(),
    });

    const request = {
      method: "GET",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: {
        lenders: [
          {
            id: "lender-1",
            name: "Banco Galicia",
            type: "bank",
          },
        ],
      },
    });
  });

  it("returns 201 when the catalog is saved", async () => {
    const database = {} as TursoDatabase;
    const save = jest.fn().mockResolvedValue({
      id: "lenders-file-id",
      name: "lenders-catalog",
    });
    const handler = createLendersApiHandler({
      get: jest.fn(),
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save,
    });

    const request = {
      body: {
        lenders: [
          {
            id: "lender-1",
            name: "Banco Galicia",
            type: "bank",
          },
        ],
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(save).toHaveBeenCalledWith({
      command: {
        lenders: [
          {
            id: "lender-1",
            name: "Banco Galicia",
            type: "bank",
          },
        ],
      },
      database,
      request,
      userSubject: "google-user-123",
    });
    expect(response.statusCode).toBe(201);
  });

  it("logs and returns 400 when save fails with a domain error", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const database = {} as TursoDatabase;
    const handler = createLendersApiHandler({
      get: jest.fn(),
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save: jest.fn().mockRejectedValue(new Error("invalid lenders payload")),
    });

    const request = {
      body: {
        lenders: [
          {
            id: "lender-1",
            name: "Banco Galicia",
            type: "bank",
          },
        ],
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "invalid lenders payload",
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
