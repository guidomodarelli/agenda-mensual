import { vi, describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  createRow,
  renderMonthlyExpensesTable,
} from "./monthly-expenses-table-test-utils";

describe("MonthlyExpensesTable month navigation", () => {
  it("navigates to the previous month", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();

    renderMonthlyExpensesTable([createRow()], {
      month: "2026-04",
      onMonthChange,
    });

    await user.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(onMonthChange).toHaveBeenCalledWith("2026-03");
  });

  it("navigates to the next month across a year boundary", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();

    renderMonthlyExpensesTable([createRow()], {
      month: "2026-12",
      onMonthChange,
    });

    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));

    expect(onMonthChange).toHaveBeenCalledWith("2027-01");
  });

  it("navigates to the current month with the today shortcut", async () => {
    const user = userEvent.setup();
    const onMonthChange = vi.fn();
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    renderMonthlyExpensesTable([createRow()], {
      month: "2020-01",
      onMonthChange,
    });

    await user.click(
      screen.getByRole("button", { name: "Ir al mes actual" }),
    );

    expect(onMonthChange).toHaveBeenCalledWith(currentYearMonth);
  });

  it("disables the today shortcut when the current month is already visible", () => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    renderMonthlyExpensesTable([createRow()], {
      month: currentYearMonth,
    });

    expect(
      screen.getByRole("button", { name: "Ir al mes actual" }),
    ).toBeDisabled();
  });

  it("disables month navigation while a month transition is pending", () => {
    renderMonthlyExpensesTable([createRow()], {
      isMonthTransitionPending: true,
      month: "2026-04",
    });

    expect(
      screen.getByRole("button", { name: "Mes anterior" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mes siguiente" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Ir al mes actual" }),
    ).toBeDisabled();
  });

  it("disables adjacent month navigation when the month value is invalid", () => {
    renderMonthlyExpensesTable([createRow()], {
      month: "",
    });

    expect(
      screen.getByRole("button", { name: "Mes anterior" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mes siguiente" }),
    ).toBeDisabled();
  });
});
