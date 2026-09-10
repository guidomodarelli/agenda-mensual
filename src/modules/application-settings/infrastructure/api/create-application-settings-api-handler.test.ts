import { vi, describe, it, expect, beforeEach } from "vitest";
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns 201 when settings are saved", async () => {
    const database = {} as TursoDatabase;
    const save = vi.fn().mockResolvedValue({
      id: "google-user-123:application-settings.json",
      mimeType: "application/json",
      name: "application-settings.json",
    });
    const handler = createApplicationSettingsApiHandler({
      getDatabase: vi.fn().mockReturnValue(database),
      getUserSubject: vi.fn().mockResolvedValue("google-user-123"),
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

  it("logs and returns 400 when settings save fails with an application error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(function () { return undefined; });
    const database = {} as TursoDatabase;
    const handler = createApplicationSettingsApiHandler({
      getDatabase: vi.fn().mockReturnValue(database),
      getUserSubject: vi.fn().mockResolvedValue("google-user-123"),
      save: vi.fn().mockRejectedValue(new Error("invalid settings")),
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

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "invalid settings",
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
