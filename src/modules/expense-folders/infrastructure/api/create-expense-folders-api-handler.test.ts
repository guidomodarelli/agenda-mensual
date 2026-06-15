import type { NextApiRequest, NextApiResponse } from "next";
import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import { ExpenseFoldersCatalogValidationError } from "@/modules/expense-folders/domain/value-objects/expense-folders-catalog-document";
import { TECHNICAL_ERROR_CODES } from "@/modules/shared/infrastructure/errors/technical-error-codes";

import { createExpenseFoldersApiHandler } from "./create-expense-folders-api-handler";

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

describe("createExpenseFoldersApiHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("returns 200 with the folders catalog when the request is GET", async () => {
    const database = {} as TursoDatabase;
    const handler = createExpenseFoldersApiHandler({
      get: jest.fn().mockResolvedValue({
        folders: [
          {
            color: "blue",
            icon: "home",
            id: "folder-1",
            name: "Hogar",
            position: 0,
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
        folders: [
          {
            color: "blue",
            icon: "home",
            id: "folder-1",
            name: "Hogar",
            position: 0,
          },
        ],
      },
    });
  });

  it("returns 201 when the catalog is saved", async () => {
    const database = {} as TursoDatabase;
    const save = jest.fn().mockResolvedValue({
      id: "google-user-123:expense-folders-catalog",
      name: "expense-folders-catalog",
    });
    const handler = createExpenseFoldersApiHandler({
      get: jest.fn(),
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save,
    });

    const request = {
      body: {
        folders: [
          {
            color: "blue",
            icon: "home",
            id: "folder-1",
            name: "Hogar",
            position: 0,
          },
        ],
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(save).toHaveBeenCalledWith({
      command: {
        folders: [
          {
            color: "blue",
            icon: "home",
            id: "folder-1",
            name: "Hogar",
            position: 0,
          },
        ],
      },
      database,
      request,
      userSubject: "google-user-123",
    });
    expect(response.statusCode).toBe(201);
  });

  it("returns 400 when the POST payload is invalid", async () => {
    const handler = createExpenseFoldersApiHandler({
      get: jest.fn(),
      getDatabase: jest.fn().mockReturnValue({} as TursoDatabase),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save: jest.fn(),
    });

    const request = {
      body: {
        folders: [
          {
            id: "",
            name: "",
          },
        ],
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
  });

  it("logs and returns 400 when save fails with a domain validation error", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const database = {} as TursoDatabase;
    const handler = createExpenseFoldersApiHandler({
      get: jest.fn(),
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save: jest
        .fn()
        .mockRejectedValue(
          new ExpenseFoldersCatalogValidationError(
            "Saving expense folders catalog requires folder names to be unique.",
          ),
        ),
    });

    const request = {
      body: {
        folders: [
          {
            id: "folder-1",
            name: "Hogar",
          },
        ],
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "Saving expense folders catalog requires folder names to be unique.",
    });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns a 500 cataloged envelope when save throws an unexpected technical error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const database = {} as TursoDatabase;
    const handler = createExpenseFoldersApiHandler({
      get: jest.fn(),
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save: jest
        .fn()
        .mockRejectedValue(new Error("SQLITE_ERROR: no such table: expense_folders")),
    });

    const request = {
      body: {
        folders: [
          {
            id: "folder-1",
            name: "Hogar",
          },
        ],
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: "We could not manage expense folders right now. Try again later.",
      errorCode: TECHNICAL_ERROR_CODES.EXPENSE_FOLDERS_API_UNEXPECTED_ERROR,
    });
  });

  it("returns a 500 cataloged envelope when GET throws an unexpected technical error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = createExpenseFoldersApiHandler({
      get: jest
        .fn()
        .mockRejectedValue(new Error("SQLITE_ERROR: database is locked")),
      getDatabase: jest.fn().mockReturnValue({} as TursoDatabase),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save: jest.fn(),
    });

    const request = {
      method: "GET",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: "We could not manage expense folders right now. Try again later.",
      errorCode: TECHNICAL_ERROR_CODES.EXPENSE_FOLDERS_API_UNEXPECTED_ERROR,
    });
  });
});
