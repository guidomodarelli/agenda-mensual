import { describe, it, expect } from "vitest";
import {
  createTechnicalErrorEnvelope,
  getTechnicalErrorCode,
  parseTechnicalErrorResponse,
  TechnicalApiError,
} from "./technical-error";

describe("technical-error", () => {
  it("parses a technical error envelope with code", () => {
    expect(
      parseTechnicalErrorResponse({
        error: "Unexpected failure.",
        errorCode: "E1000",
      }),
    ).toEqual({
      error: "Unexpected failure.",
      errorCode: "E1000",
    });
  });

  it("parses legacy error envelopes without code", () => {
    expect(
      parseTechnicalErrorResponse({
        error: "Unexpected failure.",
      }),
    ).toEqual({
      error: "Unexpected failure.",
      errorCode: null,
    });
  });

  it("creates typed envelopes", () => {
    expect(
      createTechnicalErrorEnvelope(
        "Unexpected failure.",
        "E1000",
      ),
    ).toEqual({
      error: "Unexpected failure.",
      errorCode: "E1000",
    });
  });

  it("extracts codes from technical errors", () => {
    const error = new TechnicalApiError("Unexpected failure.", {
      errorCode: "E1000",
    });

    expect(getTechnicalErrorCode(error)).toBe("E1000");
    expect(getTechnicalErrorCode(new Error("no-code"))).toBeNull();
  });
});
