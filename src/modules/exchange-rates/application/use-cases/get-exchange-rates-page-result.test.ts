import { vi, describe, it, expect } from "vitest";
import { getExchangeRatesPageResult } from "./get-exchange-rates-page-result";

describe("getExchangeRatesPageResult", () => {
  it("builds the page result from the selected month snapshot", async () => {
    const result = await getExchangeRatesPageResult({
      canEditIibb: true,
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
            rate: 1250,
            sourceDateIso: "2026-03-31",
            variant: "blue",
          }),
      },
      maxSelectableMonth: "2026-03",
      minSelectableMonth: "2026-01",
      month: "2026-03",
      monthlyExchangeRateSnapshotsRepository: {
        getByMonth: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockImplementation(async function (snapshot) { return snapshot; }),
      },
    });

    expect(result).toEqual({
      blueRate: 1250,
      canEditIibb: true,
      iibbRateDecimal: 0.02,
      loadErrorCode: null,
      loadError: null,
      maxSelectableMonth: "2026-03",
      minSelectableMonth: "2026-01",
      officialRate: 1200,
      selectedMonth: "2026-03",
      solidarityRate: 1476,
    });
  });

  it("uses the cached monthly snapshot when it already exists", async () => {
    const getMonthlyRate = vi.fn();

    const result = await getExchangeRatesPageResult({
      canEditIibb: false,
      exchangeRatesRepository: {
        getMonthlyRate,
      },
      maxSelectableMonth: "2026-03",
      minSelectableMonth: "2026-03",
      month: "2026-03",
      monthlyExchangeRateSnapshotsRepository: {
        getByMonth: vi.fn().mockResolvedValue({
          blueRate: 1240,
          iibbRateDecimalUsed: 0.02,
          month: "2026-03",
          officialRate: 1200,
          solidarityRate: 1476,
          source: "ambito-historico-general",
          sourceDateIso: "2026-03-31",
          updatedAtIso: "2026-03-14T12:00:00.000Z",
        }),
        save: vi.fn(),
      },
    });

    expect(getMonthlyRate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      blueRate: 1240,
      selectedMonth: "2026-03",
      solidarityRate: 1476,
    });
  });
});
