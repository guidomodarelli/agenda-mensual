import type { NextApiRequest, NextApiResponse } from "next";

import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

import { createApplicationSettingsApiHandler } from "./create-application-settings-api-handler";

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

describe("createApplicationSettingsApiHandler", () => {
  it("returns 201 when settings are saved", async () => {
    const database = {} as TursoDatabase;
    const save = jest.fn().mockResolvedValue({
      id: "google-user-123:application-settings.json",
      mimeType: "application/json",
      name: "application-settings.json",
    });
    const handler = createApplicationSettingsApiHandler({
      getDatabase: jest.fn().mockReturnValue(database),
      getUserSubject: jest.fn().mockResolvedValue("google-user-123"),
      save,
    });

    const request = {
      body: {
        content: '{"theme":"dark"}',
        mimeType: "application/json",
        name: "application-settings.json",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(save).toHaveBeenCalledWith({
      command: {
        content: '{"theme":"dark"}',
        mimeType: "application/json",
        name: "application-settings.json",
      },
      database,
      request,
      userSubject: "google-user-123",
    });
    expect(response.statusCode).toBe(201);
  });
});
