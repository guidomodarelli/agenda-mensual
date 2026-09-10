import { vi, describe, it, expect, beforeEach, afterAll } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

import type { TursoDatabase } from "@/modules/shared/infrastructure/database/drizzle/turso-database";

vi.mock("../../../auth/infrastructure/next-auth/authenticated-user-email", () => ({
  getAuthenticatedUserEmailFromRequest: vi.fn(),
}));

import { createMonthlyIibbRateApiHandler } from "./create-monthly-iibb-rate-api-handler";

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

describe("createMonthlyIibbRateApiHandler", () => {
  const originalAllowlist = process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST;

  beforeEach(() => {
    process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST = "admin@example.com";
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    process.env.GOOGLE_ADMIN_EMAIL_ALLOWLIST = originalAllowlist;
  });

  it("allows admins to save the monthly IIBB value", async () => {
    const database = {} as TursoDatabase;
    const save = vi.fn().mockResolvedValue({
      iibbRateDecimal: 0.04,
      month: "2026-03",
      solidarityRate: 1250,
    });
    const handler = createMonthlyIibbRateApiHandler({
      getDatabase: vi.fn().mockResolvedValue(database),
      getUserEmail: vi.fn().mockResolvedValue("admin@example.com"),
      save,
    });
    const request = {
      body: {
        iibbRateDecimal: 0.04,
        month: "2026-03",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(save).toHaveBeenCalledWith({
      command: {
        iibbRateDecimal: 0.04,
        month: "2026-03",
      },
      database,
      request,
      userEmail: "admin@example.com",
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      data: {
        iibbRateDecimal: 0.04,
        month: "2026-03",
        solidarityRate: 1250,
      },
    });
  });

  it("returns 403 for authenticated users outside the admin allowlist", async () => {
    const handler = createMonthlyIibbRateApiHandler({
      getDatabase: vi.fn(),
      getUserEmail: vi.fn().mockResolvedValue("user@example.com"),
      save: vi.fn(),
    });
    const request = {
      body: {
        iibbRateDecimal: 0.04,
        month: "2026-03",
      },
      method: "POST",
    } as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      error: "Only Google admins can update the monthly IIBB configuration.",
    });
  });

  it("returns 400 when the payload is missing the month", async () => {
    const handler = createMonthlyIibbRateApiHandler({
      getDatabase: vi.fn(),
      getUserEmail: vi.fn(),
      save: vi.fn(),
    });
    const request = {
      body: {
        iibbRateDecimal: 0.04,
      },
      method: "POST",
    } as unknown as NextApiRequest;
    const response = createMockResponse();

    await handler(request, response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error:
        "monthly-iibb-rate requires a JSON body with a YYYY-MM month and a numeric iibbRateDecimal value.",
    });
  });
});
