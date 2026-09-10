import { describe, it, expect } from "vitest";
import {
  generateCorrelationId,
  withCorrelationIdHeaders,
} from "./client-correlation-id";

describe("client-correlation-id", () => {
  it("adds x-correlation-id when headers are empty", () => {
    const headers = withCorrelationIdHeaders(undefined, "correlation-id-123");

    expect(headers.get("x-correlation-id")).toBe("correlation-id-123");
  });

  it("keeps an existing x-correlation-id header", () => {
    const headers = withCorrelationIdHeaders(
      {
        "x-correlation-id": "existing-correlation-id",
      },
      "new-correlation-id",
    );

    expect(headers.get("x-correlation-id")).toBe("existing-correlation-id");
  });

  it("generates a non-empty correlation id", () => {
    const correlationId = generateCorrelationId();

    expect(correlationId).toEqual(expect.any(String));
    expect(correlationId.length).toBeGreaterThan(0);
  });
});