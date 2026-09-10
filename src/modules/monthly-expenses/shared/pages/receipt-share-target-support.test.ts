import { describe, it, expect } from "vitest";
import {
  buildPayloadFromFile,
  isIosShareTargetUnsupported,
} from "./receipt-share-target-support";

describe("receipt share target platform support", () => {
  it("returns true for iPhone user agents", () => {
    expect(
      isIosShareTargetUnsupported({
        platform: "iPhone",
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
      }),
    ).toBe(true);
  });

  it("returns true for iPadOS reporting desktop platform", () => {
    expect(
      isIosShareTargetUnsupported({
        maxTouchPoints: 5,
        platform: "MacIntel",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
      }),
    ).toBe(true);
  });

  it("returns false for non-iOS devices", () => {
    expect(
      isIosShareTargetUnsupported({
        maxTouchPoints: 0,
        platform: "Linux armv8l",
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
      }),
    ).toBe(false);
  });

  it("returns false when navigator is not available", () => {
    expect(isIosShareTargetUnsupported()).toBe(false);
  });
});

describe("buildPayloadFromFile", () => {
  function createTestFile(
    content: string,
    name: string,
    type: string,
  ): File {
    return new File([content], name, { type });
  }

  it("builds a valid payload from a JPEG file", async () => {
    const file = createTestFile("fake-jpeg-data", "comprobante.jpg", "image/jpeg");
    const result = await buildPayloadFromFile(file);

    expect(result.status).toBe("ok");

    if (result.status !== "ok") {
      return;
    }

    expect(result.payload.fileName).toBe("comprobante.jpg");
    expect(result.payload.mimeType).toBe("image/jpeg");
    expect(result.payload.source).toBe("manual-file-picker");
    expect(result.payload.contentBase64.length).toBeGreaterThan(0);
    expect(result.payload.sizeBytes).toBe(file.size);
  });

  it("rejects unsupported MIME types", async () => {
    const file = createTestFile("text", "notes.txt", "text/plain");
    const result = await buildPayloadFromFile(file);

    expect(result.status).toBe("error");

    if (result.status === "error") {
      expect(result.message).toContain("PDF");
    }
  });

  it("rejects files exceeding 5 MB", async () => {
    const blob = new Blob([new ArrayBuffer(5 * 1024 * 1024 + 1)], {
      type: "image/png",
    });
    const file = new File([blob], "big.png", { type: "image/png" });
    const result = await buildPayloadFromFile(file);

    expect(result.status).toBe("error");

    if (result.status === "error") {
      expect(result.message).toContain("5 MB");
    }
  });

  it("sanitizes dangerous characters in file names", async () => {
    const file = createTestFile("ok", "../../etc/passwd", "image/png");
    const result = await buildPayloadFromFile(file);

    expect(result.status).toBe("ok");

    if (result.status === "ok") {
      expect(result.payload.fileName).not.toContain("/");
      expect(result.payload.fileName).not.toContain("\\");
    }
  });
});
