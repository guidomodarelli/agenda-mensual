import { describe, it, expect } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { formatConvertedAmount } from "./monthly-expenses-currency";
import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

/**
 * Intl formats es-AR currency with non-breaking spaces, while Testing Library
 * normalizes DOM text to plain spaces before matching.
 */
function formatExpectedAmount(
  currency: Parameters<typeof formatConvertedAmount>[0],
  value: number,
): string {
  return formatConvertedAmount(currency, value).replace(/\s/g, " ");
}

const PAID_ROW = createRow({
  description: "Luz",
  id: "expense-paid",
  manualCoveredPayments: "1",
  occurrencesPerMonth: "1",
  subtotal: "1000",
  total: "1000",
});
const PENDING_ROW = createRow({
  description: "Internet",
  id: "expense-pending",
  manualCoveredPayments: "0",
  occurrencesPerMonth: "1",
  subtotal: "2000",
  total: "2000",
});


function hasNormalizedText(expectedText: string) {
  return (_content: string, element: Element | null): boolean =>
    element?.tagName === "SPAN" &&
    (element.textContent ?? "").replace(/\s+/g, " ").trim() === expectedText;
}

describe("MonthlyExpensesTable totals footer", () => {
  it("shows the month total with a paid versus pending breakdown", () => {
    renderMonthlyExpensesTable([PAID_ROW, PENDING_ROW]);

    // El resumen del encabezado repite los montos: acotar al footer (tfoot).
    const rowGroups = screen.getAllByRole("rowgroup");
    const footer = within(rowGroups[rowGroups.length - 1]);

    expect(
      footer.getByText(formatExpectedAmount("ARS", 3000)),
    ).toBeInTheDocument();
    expect(
      footer.getByText(hasNormalizedText(`Pagado: ${formatExpectedAmount("ARS", 1000)}`)),
    ).toBeInTheDocument();
    expect(
      footer.getByText(hasNormalizedText(`Pendiente: ${formatExpectedAmount("ARS", 2000)}`)),
    ).toBeInTheDocument();
  });

  it("recalculates the totals with the active filters", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([PAID_ROW, PENDING_ROW]);

    const queryBar = screen.getByRole("combobox", {
      name: "Filtro unificado de gastos",
    });
    await user.click(queryBar);
    await user.type(queryBar, "Internet");

    await waitFor(() => {
      const rowGroups = screen.getAllByRole("rowgroup");
      const footerRowGroup = rowGroups[rowGroups.length - 1];

      // El mismo monto aparece también como "Pendiente": acotar al total.
      expect(
        within(footerRowGroup).getByText(formatExpectedAmount("ARS", 2000), {
          selector: ".totalFooterValue",
        }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(hasNormalizedText(`Pagado: ${formatExpectedAmount("ARS", 0)}`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(hasNormalizedText(`Pendiente: ${formatExpectedAmount("ARS", 2000)}`)),
    ).toBeInTheDocument();
  });

  it("converts the totals to USD in the converted column footer", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([PAID_ROW, PENDING_ROW], {
      exchangeRateSnapshot: {
        blueRate: 1000,
        month: "2026-04",
        officialRate: 1000,
        solidarityRate: 1000,
      },
    });

    await user.click(screen.getByRole("button", { name: "Vista" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /^USD/ }));

    expect(
      await screen.findByText(hasNormalizedText(`Pagado: ${formatExpectedAmount("USD", 1)}`)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(hasNormalizedText(`Pendiente: ${formatExpectedAmount("USD", 2)}`)),
    ).toBeInTheDocument();
  });
});
