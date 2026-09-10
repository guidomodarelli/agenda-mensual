import { describe, it, expect } from "vitest";
import { getHomeRedirectDestination } from "@/app/page";

describe("HomePage redirect", () => {
  it("redirects root traffic to /gastos", () => {
    const destination = getHomeRedirectDestination({});

    expect(destination).toBe("/gastos");
  });

  it("ignores tab=lenders and keeps the canonical /gastos redirect", () => {
    const destination = getHomeRedirectDestination({
      tab: "lenders",
    });

    expect(destination).toBe("/gastos");
  });

  it("ignores tab=exchange-rates and keeps the canonical /gastos redirect", () => {
    const destination = getHomeRedirectDestination({
      tab: "exchange-rates",
    });

    expect(destination).toBe("/gastos");
  });

  it("preserves month even when a tab query is sent", () => {
    const destination = getHomeRedirectDestination({
      month: "2026-03",
      tab: "exchange-rates",
    });

    expect(destination).toBe("/gastos?month=2026-03");
  });

  it("preserves month when redirecting to /gastos", () => {
    const destination = getHomeRedirectDestination({
      month: "2026-04",
    });

    expect(destination).toBe("/gastos?month=2026-04");
  });
});
