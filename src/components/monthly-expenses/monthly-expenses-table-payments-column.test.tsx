import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

const PAYMENT_RECORD = {
  coveredPayments: 1,
  id: "payment-record-1",
  registeredAt: null,
  sendStatus: "sent" as const,
};

describe("MonthlyExpensesTable unified payments column", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the payment records trigger inside the Pagos cell without a Registros column", () => {
    renderMonthlyExpensesTable([createRow({ description: "Internet" })]);

    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent?.trim() ?? "");

    expect(headers).toContain("Pagos");
    expect(headers).not.toContain("Registros");
    expect(
      screen.getByRole("button", {
        name: "Agregar nuevo registro de pago para Internet",
      }),
    ).toBeInTheDocument();
  });

  it("does not offer Registros as a hideable column in the Vista menu", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([createRow()]);

    await user.click(screen.getByRole("button", { name: "Vista" }));

    expect(
      screen.queryByRole("menuitemcheckbox", { name: /Registros/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Pagos/ }),
    ).toBeInTheDocument();
  });

  it("keeps the registros qualifier filtering through the hidden column", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Con registro",
        id: "expense-1",
        paymentRecords: [PAYMENT_RECORD],
      }),
      createRow({
        description: "Sin registro",
        id: "expense-2",
        paymentRecords: [],
      }),
    ]);

    const queryBar = screen.getByRole("combobox", {
      name: "Filtro unificado de gastos",
    });

    await user.click(queryBar);
    await user.type(queryBar, "registros:>=1");

    await waitFor(() => {
      expect(screen.queryByText("Sin registro")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Con registro")).toBeInTheDocument();
  });
});
