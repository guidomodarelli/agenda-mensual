import type { NextApiHandler } from "next";

import { createAppRouteHandler } from "./next-api-handler-adapter";

jest.mock("next/server", () => {
  class MockNextResponse {
    readonly body: string | null;
    readonly headers: Headers;
    readonly status: number;

    constructor(body: string | null, init?: ResponseInit) {
      this.body = body;
      this.headers = new Headers(init?.headers);
      this.status = init?.status ?? 200;
    }

    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(JSON.stringify(body), init);
    }

    async json() {
      return this.body ? JSON.parse(this.body) as unknown : null;
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

function createRequest({
  body,
  contentType = "application/json",
  method = "POST",
}: {
  body?: string;
  contentType?: string;
  method?: string;
}) {
  const headers = new Headers();

  headers.set("content-type", contentType);

  return {
    cookies: {
      getAll: () => [],
    },
    headers,
    json: async () => JSON.parse(body ?? ""),
    method,
    nextUrl: new URL("http://localhost/api/storage/user-files"),
    text: async () => body ?? "",
  };
}

describe("createAppRouteHandler", () => {
  it("lets legacy handlers reject malformed JSON as a controlled bad request", async () => {
    const legacyHandler: NextApiHandler = jest.fn((request, response) => {
      if (request.body === undefined) {
        response.status(400).json({ error: "Invalid JSON payload." });
        return;
      }

      response.status(200).json({ data: request.body });
    });
    const handler = createAppRouteHandler(legacyHandler);
    const request = createRequest({
      body: "{",
      method: "POST",
    });

    const response = await handler(request as never);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON payload.",
    });
    expect(response.status).toBe(400);
    expect(legacyHandler).toHaveBeenCalledTimes(1);
  });

  it("passes parsed JSON bodies to legacy handlers", async () => {
    const legacyHandler: NextApiHandler = jest.fn((request, response) => {
      response.status(200).json({ data: request.body });
    });
    const handler = createAppRouteHandler(legacyHandler);
    const request = createRequest({
      body: JSON.stringify({ name: "receipt.pdf" }),
      method: "POST",
    });

    const response = await handler(request as never);

    await expect(response.json()).resolves.toEqual({
      data: {
        name: "receipt.pdf",
      },
    });
    expect(response.status).toBe(200);
  });
});
