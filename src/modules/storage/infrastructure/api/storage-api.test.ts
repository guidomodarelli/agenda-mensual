import { vi, describe, it, expect } from "vitest";
import { saveApplicationSettingsViaApi } from "./storage-api";

describe("storage-api client", () => {
  it("sends x-correlation-id header on POST requests", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          id: "settings-file-id",
          mimeType: "application/json",
          name: "application-settings.json",
          viewUrl: null,
        },
      }),
      ok: true,
    });

    await saveApplicationSettingsViaApi(
      {
        content: '{"theme":"dark"}',
        mimeType: "application/json",
        name: "application-settings.json",
      },
      fetchImplementation,
    );

    const options = fetchImplementation.mock.calls[0]?.[1] as
      | RequestInit
      | undefined;
    const headers = new Headers(options?.headers);

    expect(headers.get("x-correlation-id")).toEqual(expect.any(String));
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
