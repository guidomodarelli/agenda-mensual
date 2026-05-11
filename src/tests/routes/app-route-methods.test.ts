import * as monthlyExpensesRoute from "@/app/api/storage/monthly-expenses/route";

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

jest.mock("@/modules/auth/infrastructure/google-drive/google-drive-client", () => ({
  getGoogleDriveClientFromRequest: jest.fn(),
}));

type AppRouteHandler = (request: never) => Promise<Response>;

function createUnsupportedMethodRequest(method: string) {
  return {
    cookies: {
      getAll: () => [],
    },
    headers: new Headers(),
    json: async () => undefined,
    method,
    nextUrl: new URL("http://localhost/api/storage/monthly-expenses"),
    text: async () => "",
  };
}

describe("App Router API method contracts", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the legacy 405 response when monthly expenses receives an unsupported method", async () => {
    const routeHandlers = monthlyExpensesRoute as Record<string, AppRouteHandler>;

    expect(typeof routeHandlers.PUT).toBe("function");

    const response = await routeHandlers.PUT(
      createUnsupportedMethodRequest("PUT") as never,
    );

    await expect(response.json()).resolves.toEqual({
      error: "monthly-expenses only supports GET and POST requests on this endpoint.",
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, POST");
  });
});
