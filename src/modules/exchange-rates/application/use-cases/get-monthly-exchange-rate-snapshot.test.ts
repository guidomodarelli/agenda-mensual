import { vi, describe, it, expect } from "vitest";
import { getMonthlyExchangeRateSnapshot } from "./get-monthly-exchange-rate-snapshot";

describe("getMonthlyExchangeRateSnapshot", () => {
  it("returns the cached snapshot as-is without touching Ambito or persisting", async () => {
    const getMonthlyRate = vi.fn();
    const save = vi.fn();

    const result = await getMonthlyExchangeRateSnapshot({
      exchangeRatesRepository: {
        getMonthlyRate,
      },
      month: "2026-03",
      monthlyExchangeRateSnapshotsRepository: {
        getByMonth: vi.fn().mockResolvedValue({
          blueRate: 1290,
          iibbRateDecimalUsed: 0.02,
          month: "2026-03",
          officialRate: 1200,
          solidarityRate: 1476,
          source: "ambito-historico-general",
          sourceDateIso: "2026-03-31",
          updatedAtIso: "2026-03-14T12:00:00.000Z",
        }),
        save,
      },
    });

    expect(getMonthlyRate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result.solidarityRate).toBe(1476);
  });

  it("keeps a cached per-month IIBB instead of overwriting it with a default", async () => {
    const save = vi.fn();

    const result = await getMonthlyExchangeRateSnapshot({
      exchangeRatesRepository: {
        getMonthlyRate: vi.fn(),
      },
      month: "2026-03",
      monthlyExchangeRateSnapshotsRepository: {
        getByMonth: vi.fn().mockResolvedValue({
          blueRate: 1290,
          iibbRateDecimalUsed: 0.05,
          month: "2026-03",
          officialRate: 1200,
          solidarityRate: 1512,
          source: "ambito-historico-general",
          sourceDateIso: "2026-03-31",
          updatedAtIso: "2026-03-14T12:00:00.000Z",
        }),
        save,
      },
    });

    expect(save).not.toHaveBeenCalled();
    expect(result.iibbRateDecimalUsed).toBe(0.05);
    expect(result.solidarityRate).toBe(1512);
  });

  it("queries Ambito and seeds the snapshot with the default IIBB on cache miss", async () => {
    const save = vi.fn().mockImplementation(async function (snapshot) { return snapshot; });

    const result = await getMonthlyExchangeRateSnapshot({
      exchangeRatesRepository: {
        getMonthlyRate: vi
          .fn()
          .mockResolvedValueOnce({
            month: "2026-03",
            rate: 1200,
            sourceDateIso: "2026-03-31",
            variant: "official",
          })
          .mockResolvedValueOnce({
            month: "2026-03",
            rate: 1290,
            sourceDateIso: "2026-03-31",
            variant: "blue",
          }),
      },
      month: "2026-03",
      monthlyExchangeRateSnapshotsRepository: {
        getByMonth: vi.fn().mockResolvedValue(null),
        save,
      },
      now: () => new Date("2026-03-14T12:00:00.000Z"),
    });

    expect(save).toHaveBeenCalledWith({
      blueRate: 1290,
      iibbRateDecimalUsed: 0.02,
      month: "2026-03",
      officialRate: 1200,
      solidarityRate: 1476,
      source: "ambito-historico-general",
      sourceDateIso: "2026-03-31",
      updatedAtIso: "2026-03-14T12:00:00.000Z",
    });
    expect(result.solidarityRate).toBe(1476);
  });
});
