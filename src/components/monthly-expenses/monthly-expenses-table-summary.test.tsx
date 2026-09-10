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
function formatExpectedAmount(value: number): string {
  return formatConvertedAmount("ARS", value).replace(/\s/g, " ");
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

function getSummaryRegion() {
  return within(screen.getByRole("region", { name: "Resumen del mes" }));
}

describe("MonthlyExpensesTable month summary", () => {
  it("shows total, pending and paid cards for the visible rows", () => {
    renderMonthlyExpensesTable([PAID_ROW, PENDING_ROW]);

    const summary = getSummaryRegion();

    expect(summary.getByText("Total")).toBeInTheDocument();
    expect(summary.getByText(formatExpectedAmount(3000))).toBeInTheDocument();
    expect(summary.getByText("Pendiente")).toBeInTheDocument();
    expect(summary.getByText(formatExpectedAmount(2000))).toBeInTheDocument();
    expect(summary.getByText("Pagado")).toBeInTheDocument();
    expect(summary.getByText(formatExpectedAmount(1000))).toBeInTheDocument();
  });

  it("recalculates the summary with the active filters", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([PAID_ROW, PENDING_ROW]);

    const queryBar = screen.getByRole("combobox", {
      name: "Filtro unificado de gastos",
    });

    await user.click(queryBar);
    await user.type(queryBar, "Luz");

    await waitFor(() => {
      const summary = getSummaryRegion();

      // Con solo la fila pagada visible, Total y Pagado comparten el monto.
      expect(summary.getAllByText(formatExpectedAmount(1000))).toHaveLength(2);
      expect(summary.getByText(formatExpectedAmount(0))).toBeInTheDocument();
    });
  });
});
