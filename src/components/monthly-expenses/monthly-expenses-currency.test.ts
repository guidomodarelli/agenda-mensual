import { describe, it, expect } from "vitest";
import {
  getConvertedAmountForCurrency,
  getUsdRateForRow,
} from "./monthly-expenses-currency";
import type {
  ExchangeRateSnapshot,
  MonthlyExpenseUsdRateSettings,
} from "./monthly-expenses-table.types";

const SNAPSHOT: ExchangeRateSnapshot = {
  blueRate: 1500,
  month: "2026-07",
  officialRate: 1000,
  solidarityRate: 1300,
};

function buildUsdRate(
  overrides: Partial<MonthlyExpenseUsdRateSettings> = {},
): MonthlyExpenseUsdRateSettings {
  return {
    appliesIibb: false,
    appliesIva: false,
    base: "official",
    customRate: null,
    ...overrides,
  };
}

describe("getUsdRateForRow", () => {
  it("resolves each base against the snapshot", () => {
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({ base: "blue" }),
      }),
    ).toBe(1500);
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({ base: "official" }),
      }),
    ).toBe(1000);
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({ base: "custom", customRate: 1480.5 }),
      }),
    ).toBe(1480.5);
  });

  it("adds only the IIBB perception (additive, without VAT) derived from the snapshot", () => {
    // IIBB decimal = solidario / oficial - 1 - 0.21 = 1.3 - 1.21 = 0.09.
    // Solo IIBB => base × (1 + 0.09).
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({ appliesIibb: true, base: "official" }),
      }),
    ).toBeCloseTo(1090);
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({ appliesIibb: true, base: "blue" }),
      }),
    ).toBeCloseTo(1635);
  });

  it("adds IIBB and 21% VAT additively without double-counting VAT", () => {
    // Solo IVA => base × (1 + 0.21).
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({ appliesIva: true, base: "official" }),
      }),
    ).toBeCloseTo(1210);
    // IIBB + IVA => base × (1 + 0.09 + 0.21) = solidario, sin duplicar el IVA.
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({
          appliesIibb: true,
          appliesIva: true,
          base: "official",
        }),
      }),
    ).toBeCloseTo(1300);
  });

  it("supports surcharges over a custom base without needing the base quotes", () => {
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({
          appliesIva: true,
          base: "custom",
          customRate: 1000,
        }),
      }),
    ).toBeCloseTo(1210);
  });

  it("returns null when a needed snapshot is missing or the custom rate is invalid", () => {
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: null,
        usdRate: buildUsdRate({ base: "blue" }),
      }),
    ).toBeNull();
    // Un custom sin IIBB no necesita snapshot…
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: null,
        usdRate: buildUsdRate({ base: "custom", customRate: 2000 }),
      }),
    ).toBe(2000);
    // …pero con IIBB sí (el factor sale del snapshot).
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: null,
        usdRate: buildUsdRate({
          appliesIibb: true,
          base: "custom",
          customRate: 2000,
        }),
      }),
    ).toBeNull();
    expect(
      getUsdRateForRow({
        exchangeRateSnapshot: SNAPSHOT,
        usdRate: buildUsdRate({ base: "custom", customRate: 0 }),
      }),
    ).toBeNull();
  });
});

describe("getConvertedAmountForCurrency", () => {
  it("converts USD to ARS with the per-row settings", () => {
    expect(
      getConvertedAmountForCurrency({
        currency: "ARS",
        exchangeRateSnapshot: SNAPSHOT,
        rowCurrency: "USD",
        total: 10,
        usdRate: buildUsdRate({ base: "blue" }),
      }),
    ).toBe(15000);
  });

  it("keeps the solidario (official + IIBB + VAT) as the default when no settings are given", () => {
    expect(
      getConvertedAmountForCurrency({
        currency: "ARS",
        exchangeRateSnapshot: SNAPSHOT,
        rowCurrency: "USD",
        total: 10,
      }),
    ).toBe(13000);
  });

  it("converts ARS to USD dividing by the per-row rate", () => {
    expect(
      getConvertedAmountForCurrency({
        currency: "USD",
        exchangeRateSnapshot: SNAPSHOT,
        rowCurrency: "ARS",
        total: 4000,
        usdRate: buildUsdRate({ base: "custom", customRate: 2000 }),
      }),
    ).toBe(2);
  });
});
