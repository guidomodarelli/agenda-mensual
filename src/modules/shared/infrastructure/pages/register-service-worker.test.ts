import { vi, describe, it, expect } from "vitest";
import { registerServiceWorker } from "@/modules/shared/infrastructure/pages/register-service-worker";

describe("registerServiceWorker", () => {
  it("registers /sw.js in production", () => {
    const register = vi.fn().mockResolvedValue(undefined);

    registerServiceWorker({
      navigatorRef: {
        serviceWorker: {
          register,
        } as unknown as Navigator["serviceWorker"],
      },
      nodeEnv: "production",
    });

    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("does not register outside production", () => {
    const register = vi.fn().mockResolvedValue(undefined);

    registerServiceWorker({
      navigatorRef: {
        serviceWorker: {
          register,
        } as unknown as Navigator["serviceWorker"],
      },
      nodeEnv: "development",
    });

    expect(register).not.toHaveBeenCalled();
  });

  it("does not throw without serviceWorker support", () => {
    expect(() => {
      registerServiceWorker({
        navigatorRef: undefined,
        nodeEnv: "production",
      });
    }).not.toThrow();
  });
});
