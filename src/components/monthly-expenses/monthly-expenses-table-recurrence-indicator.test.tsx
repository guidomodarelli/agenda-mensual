import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

describe("MonthlyExpensesTable recurrence indicator", () => {
  it("shows an accessible recurring icon next to the description of an active recurring expense", () => {
    renderMonthlyExpensesTable([
      createRow({
        description: "Alquiler",
        id: "expense-1",
        isRecurring: true,
        recurrenceEndMonth: "",
      }),
    ]);

    expect(screen.getByLabelText("Gasto recurrente")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Recurrencia cancelada"),
    ).not.toBeInTheDocument();
  });

  it("shows a muted cancelled indicator when the recurrence has an end month", () => {
    renderMonthlyExpensesTable([
      createRow({
        description: "Gimnasio",
        id: "expense-1",
        isRecurring: true,
        recurrenceEndMonth: "2026-04",
      }),
    ]);

    expect(
      screen.getByLabelText("Recurrencia cancelada"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Gasto recurrente"),
    ).not.toBeInTheDocument();
  });

  it("filters recurring expenses with the tiene:/no: recurrencia qualifiers", async () => {
    const user = userEvent.setup();

    renderMonthlyExpensesTable([
      createRow({
        description: "Alquiler",
        id: "expense-1",
        isRecurring: true,
      }),
      createRow({
        description: "Compra única",
        id: "expense-2",
        isRecurring: false,
      }),
    ]);

    const queryBar = screen.getByRole("combobox", {
      name: "Filtro unificado de gastos",
    });

    await user.click(queryBar);
    await user.type(queryBar, "no:recurrencia");

    await waitFor(() => {
      expect(screen.queryByText("Alquiler")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Compra única")).toBeInTheDocument();

    await user.clear(queryBar);
    await user.type(queryBar, "tiene:recurrencia");

    await waitFor(() => {
      expect(screen.queryByText("Compra única")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Alquiler")).toBeInTheDocument();
  });

  it("renders no recurrence indicator for one-off expenses", () => {
    renderMonthlyExpensesTable([
      createRow({
        description: "Compra única",
        id: "expense-1",
        isRecurring: false,
      }),
    ]);

    expect(
      screen.queryByLabelText("Gasto recurrente"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Recurrencia cancelada"),
    ).not.toBeInTheDocument();
  });
});
