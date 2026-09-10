import { vi, describe, it, expect } from "vitest";
import { saveMonthlyIibbRate } from "./save-monthly-iibb-rate";

const CACHED_SNAPSHOT = {
  blueRate: 1290,
  iibbRateDecimalUsed: 0.02,
  month: "2026-03",
  officialRate: 1200,
  solidarityRate: 1476,
  source: "ambito-historico-general",
  sourceDateIso: "2026-03-31",
  updatedAtIso: "2026-03-14T12:00:00.000Z",
};

describe("saveMonthlyIibbRate", () => {
  it("updates the month snapshot with the new IIBB and recomputed solidarity", async () => {
    const save = vi.fn().mockImplementation(async function (snapshot) { return snapshot; });

    const result = await saveMonthlyIibbRate({
      command: { iibbRateDecimal: 0.05, month: "2026-03" },
      exchangeRatesRepository: { getMonthlyRate: vi.fn() },
      monthlyExchangeRateSnapshotsRepository: {
        getByMonth: vi.fn().mockResolvedValue(CACHED_SNAPSHOT),
        save,
      },
      now: () => new Date("2026-03-20T12:00:00.000Z"),
    });

    // solidario = 1200 × (1 + 0.05 + 0.21) = 1512.
    expect(save).toHaveBeenCalledWith({
      blueRate: 1290,
      iibbRateDecimalUsed: 0.05,
      month: "2026-03",
      officialRate: 1200,
      solidarityRate: 1512,
      source: "ambito-historico-general",
      sourceDateIso: "2026-03-31",
      updatedAtIso: "2026-03-20T12:00:00.000Z",
    });
    expect(result).toEqual({
      iibbRateDecimal: 0.05,
      month: "2026-03",
      solidarityRate: 1512,
    });
  });

  it("seeds the snapshot from Ambito on cache miss before applying the IIBB", async () => {
    const save = vi.fn().mockImplementation(async function (snapshot) { return snapshot; });

    const result = await saveMonthlyIibbRate({
      command: { iibbRateDecimal: 0.03, month: "2026-03" },
      exchangeRatesRepository: {
        getMonthlyRate: vi
          .fn()
          .mockResolvedValueOnce({
            month: "2026-03",
            rate: 1000,
            sourceDateIso: "2026-03-31",
            variant: "official",
          })
          .mockResolvedValueOnce({
            month: "2026-03",
            rate: 1100,
            sourceDateIso: "2026-03-31",
            variant: "blue",
          }),
      },
      monthlyExchangeRateSnapshotsRepository: {
        getByMonth: vi.fn().mockResolvedValue(null),
        save,
      },
      now: () => new Date("2026-03-20T12:00:00.000Z"),
    });

    // solidario = 1000 × (1 + 0.03 + 0.21) = 1240.
    expect(result).toEqual({
      iibbRateDecimal: 0.03,
      month: "2026-03",
      solidarityRate: 1240,
    });
  });

  it("rejects an invalid IIBB decimal value", async () => {
    await expect(
      saveMonthlyIibbRate({
        command: { iibbRateDecimal: 1, month: "2026-03" },
        exchangeRatesRepository: { getMonthlyRate: vi.fn() },
        monthlyExchangeRateSnapshotsRepository: {
          getByMonth: vi.fn(),
          save: vi.fn(),
        },
      }),
    ).rejects.toThrow("requires an IIBB decimal value lower than 1.");
  });
});
