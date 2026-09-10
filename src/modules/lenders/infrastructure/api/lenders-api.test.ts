import { vi, describe, it, expect } from "vitest";
import { getLendersCatalogViaApi } from "./lenders-api";

describe("lenders-api client", () => {
  it("sends x-correlation-id header on GET requests", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          lenders: [],
        },
      }),
      ok: true,
    });

    await getLendersCatalogViaApi(fetchImplementation);

    const options = fetchImplementation.mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const headers = new Headers(options?.headers);

    expect(headers.get("x-correlation-id")).toEqual(expect.any(String));
  });
});
