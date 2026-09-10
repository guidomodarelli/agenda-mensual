import { vi, describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { selectDropdownSubmenuItem } from "@/tests/utils/radix-menu-test-helpers";

import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";
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

function normalizeSpaces(text: string): string {
  return text.replace(/\s/g, " ");
}

describe("MonthlyExpensesTable per-expense USD rate", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers base quotes and surcharge toggles only for USD expenses", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ currency: "USD", description: "Netflix", id: "expense-1" }),
    ]);

    await user.click(
      screen.getByRole("button", { name: "Abrir acciones para Netflix" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Tipo de cambio" }));

    for (const baseOptionName of ["Oficial", "Dólar blue", "Personalizada…"]) {
      expect(
        await screen.findByRole("menuitemradio", { name: baseOptionName }),
      ).toBeInTheDocument();
    }

    for (const surchargeName of ["Sumar IIBB", "Sumar IVA 21%"]) {
      expect(
        screen.getByRole("menuitemcheckbox", { name: surchargeName }),
      ).toBeInTheDocument();
    }
  });

  it("does not offer the rate submenu for ARS expenses", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({ currency: "ARS", description: "Alquiler", id: "expense-1" }),
    ]);

    await user.click(
      screen.getByRole("button", { name: "Abrir acciones para Alquiler" }),
    );

    expect(
      screen.queryByRole("menuitem", { name: "Tipo de cambio" }),
    ).not.toBeInTheDocument();
  });

  it("selects the blue base keeping the current surcharges", async () => {
    const onUpdateUsdRate = vi.fn();
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({
          currency: "USD",
          description: "Netflix",
          id: "expense-1",
          usdRate: buildUsdRate({ appliesIibb: true }),
        }),
      ],
      { onUpdateUsdRate },
    );

    await user.click(
      screen.getByRole("button", { name: "Abrir acciones para Netflix" }),
    );
    await selectDropdownSubmenuItem(
      user,
      "Tipo de cambio",
      "Dólar blue",
      "menuitemradio",
    );

    await waitFor(() => {
      expect(onUpdateUsdRate).toHaveBeenCalledWith({
        expenseId: "expense-1",
        usdRate: {
          appliesIibb: true,
          appliesIva: false,
          base: "blue",
          customRate: null,
        },
      });
    });
  });

  it("toggles the IVA surcharge from the submenu", async () => {
    const onUpdateUsdRate = vi.fn();
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({
          currency: "USD",
          description: "Netflix",
          id: "expense-1",
          usdRate: buildUsdRate({ base: "blue" }),
        }),
      ],
      { onUpdateUsdRate },
    );

    await user.click(
      screen.getByRole("button", { name: "Abrir acciones para Netflix" }),
    );
    await selectDropdownSubmenuItem(
      user,
      "Tipo de cambio",
      "Sumar IVA 21%",
      "menuitemcheckbox",
    );

    await waitFor(() => {
      expect(onUpdateUsdRate).toHaveBeenCalledWith({
        expenseId: "expense-1",
        usdRate: {
          appliesIibb: false,
          appliesIva: true,
          base: "blue",
          customRate: null,
        },
      });
    });
  });

  it("opens the custom-rate dialog and saves the manual rate keeping surcharges", async () => {
    const onUpdateUsdRate = vi.fn();
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({
          currency: "USD",
          description: "Spotify",
          id: "expense-1",
          usdRate: buildUsdRate({ appliesIva: true }),
        }),
      ],
      { onUpdateUsdRate },
    );

    await user.click(
      screen.getByRole("button", { name: "Abrir acciones para Spotify" }),
    );
    await selectDropdownSubmenuItem(
      user,
      "Tipo de cambio",
      "Personalizada…",
      "menuitemradio",
    );

    const rateInput = await screen.findByLabelText(
      "Cotización personalizada de Spotify",
    );

    await user.type(rateInput, "1480,50");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onUpdateUsdRate).toHaveBeenCalledWith({
        expenseId: "expense-1",
        usdRate: {
          appliesIibb: false,
          appliesIva: true,
          base: "custom",
          customRate: 1480.5,
        },
      });
    });
  });

  it("rejects a non-positive custom rate with an inline error", async () => {
    const onUpdateUsdRate = vi.fn();
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [createRow({ currency: "USD", description: "Spotify", id: "expense-1" })],
      { onUpdateUsdRate },
    );

    await user.click(
      screen.getByRole("button", { name: "Abrir acciones para Spotify" }),
    );
    await selectDropdownSubmenuItem(
      user,
      "Tipo de cambio",
      "Personalizada…",
      "menuitemradio",
    );

    const rateInput = await screen.findByLabelText(
      "Cotización personalizada de Spotify",
    );

    await user.type(rateInput, "0");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/mayor a 0/);
    expect(onUpdateUsdRate).not.toHaveBeenCalled();
  });

  it("converts the total stacking base, IIBB and IVA", () => {
    renderMonthlyExpensesTable(
      [
        createRow({
          currency: "USD",
          description: "Efectivo blue",
          id: "expense-1",
          subtotal: "10",
          total: "10",
          usdRate: buildUsdRate({ base: "blue" }),
        }),
        createRow({
          currency: "USD",
          description: "Online full",
          id: "expense-2",
          subtotal: "10",
          total: "10",
          usdRate: buildUsdRate({
            appliesIibb: true,
            appliesIva: true,
            base: "official",
          }),
        }),
      ],
      { exchangeRateSnapshot: SNAPSHOT },
    );

    const table = screen.getAllByRole("table")[0];
    const tableText = normalizeSpaces(table.textContent ?? "");

    // 10 × blue (1500) = 15.000; 10 × 1000 × (1 + 0,09 IIBB + 0,21 IVA) = 13.000.
    expect(tableText).toContain("15.000");
    expect(tableText).toContain("13.000");
  });

  it("shows a rate badge on USD rows with the effective rate in a tooltip", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable(
      [
        createRow({
          currency: "USD",
          description: "Online full",
          id: "expense-1",
          subtotal: "10",
          total: "10",
          usdRate: buildUsdRate({
            appliesIibb: true,
            appliesIva: true,
            base: "official",
          }),
        }),
        createRow({
          currency: "ARS",
          description: "Alquiler",
          id: "expense-2",
          subtotal: "1000",
          total: "1000",
        }),
      ],
      { exchangeRateSnapshot: SNAPSHOT },
    );

    const rateBadge = screen.getByText("oficial + IIBB + IVA");

    expect(rateBadge).toBeInTheDocument();

    await user.hover(rateBadge);

    const tooltip = await screen.findByRole("tooltip");

    // 1000 × (1 + 0,09 IIBB + 0,21 IVA) = 1.300 por USD.
    expect(tooltip.textContent?.replace(/\s/g, " ")).toContain("1 USD = $ 1.300");

    // Las filas ARS no llevan badge de tasa.
    const arsRow = screen.getByText("Alquiler").closest("tr");

    expect(arsRow?.textContent).not.toContain("oficial");
  });

  it("converts the total with the custom rate", () => {
    renderMonthlyExpensesTable(
      [
        createRow({
          currency: "USD",
          description: "Tasa manual",
          id: "expense-1",
          subtotal: "10",
          total: "10",
          usdRate: buildUsdRate({ base: "custom", customRate: 2000 }),
        }),
      ],
      { exchangeRateSnapshot: SNAPSHOT },
    );

    const table = screen.getAllByRole("table")[0];

    expect(normalizeSpaces(table.textContent ?? "")).toContain("20.000");
  });
});
