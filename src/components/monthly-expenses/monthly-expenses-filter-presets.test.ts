import { describe, it, expect, beforeEach } from "vitest";
import {
  getPersistedMonthlyExpensesFilterPresets,
  MONTHLY_EXPENSES_FILTER_PRESETS_STORAGE_KEY,
  persistMonthlyExpensesFilterPresets,
} from "./monthly-expenses-filter-presets";

describe("monthly expenses filter presets persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([]);
  });

  it("round-trips persisted presets", () => {
    const presets = [
      { name: "Deudas grandes", query: "total:>1000 direccion:yo-debo" },
      { name: "Sin carpeta", query: "no:carpeta" },
    ];

    persistMonthlyExpensesFilterPresets(presets);

    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual(presets);
  });

  it("ignores malformed stored data", () => {
    window.localStorage.setItem(
      MONTHLY_EXPENSES_FILTER_PRESETS_STORAGE_KEY,
      "{not json",
    );

    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([]);
  });

  it("drops entries without a valid name or query", () => {
    window.localStorage.setItem(
      MONTHLY_EXPENSES_FILTER_PRESETS_STORAGE_KEY,
      JSON.stringify([
        { name: "Válido", query: "total:>100" },
        { name: "", query: "total:>100" },
        { name: "Sin query", query: "   " },
        { name: 3, query: "total:>100" },
        "not-an-object",
      ]),
    );

    expect(getPersistedMonthlyExpensesFilterPresets()).toEqual([
      { name: "Válido", query: "total:>100" },
    ]);
  });
});
