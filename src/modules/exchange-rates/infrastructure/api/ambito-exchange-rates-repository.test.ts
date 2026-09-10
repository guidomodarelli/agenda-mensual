import { vi, describe, it, expect } from "vitest";
import { AmbitoExchangeRatesRepository } from "./ambito-exchange-rates-repository";

describe("AmbitoExchangeRatesRepository", () => {
  it("sends browser-like headers for Ambito historical exchange rate requests", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      json: async () => [
        ["Fecha", "Compra", "Venta"],
        ["31/03/2026", "1.200,00", "1.234,56"],
      ],
      ok: true,
    });
    const repository = new AmbitoExchangeRatesRepository(fetchImplementation);

    await repository.getMonthlyRate({
      month: "2026-03",
      variant: "blue",
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://mercados.ambito.com/dolar/informal/historico-general/2026-03-01/2026-03-31",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining("text/html"),
          "Accept-Language": "es-419,es;q=0.9",
          "Cache-Control": "max-age=0",
          "User-Agent": expect.stringContaining("Chrome/145.0.0.0"),
        }),
        method: "GET",
      }),
    );
  });

  it("throws when Ambito answers with a non-ok status", async () => {
    const repository = new AmbitoExchangeRatesRepository(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }),
    );

    await expect(
      repository.getMonthlyRate({
        month: "2026-03",
        variant: "official",
      }),
    ).rejects.toThrow(
      "ambito-exchange-rates-repository:getMonthlyRate received 403 for official in 2026-03.",
    );
  });
});
