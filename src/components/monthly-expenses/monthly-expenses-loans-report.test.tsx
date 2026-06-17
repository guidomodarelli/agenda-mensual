import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MonthlyExpensesLoansReport } from "./monthly-expenses-loans-report";

type RenderOverrides = Partial<
  React.ComponentProps<typeof MonthlyExpensesLoansReport>
>;

function renderReport(overrides: RenderOverrides = {}) {
  const onDirectionFilterChange = jest.fn();
  const onLenderFilterChange = jest.fn();
  const onResetFilters = jest.fn();
  const onTypeFilterChange = jest.fn();

  render(
    <MonthlyExpensesLoansReport
      entries={[
        {
          activeLoanCount: 2,
          direction: "receivable",
          expenseDescriptions: ["Tarjeta", "Seguro"],
          firstDebtMonth: "2025-12",
          latestRecordedMonth: "2026-03",
          lenderId: "lender-1",
          lenderName: "Banco Ciudad",
          lenderType: "bank",
          remainingAmount: 120500.75,
          trackedLoanCount: 2,
        },
      ]}
      feedbackMessage={null}
      onDirectionFilterChange={onDirectionFilterChange}
      onLenderFilterChange={onLenderFilterChange}
      onResetFilters={onResetFilters}
      onTypeFilterChange={onTypeFilterChange}
      providerFilterOptions={[]}
      selectedDirectionFilter="all"
      selectedLenderFilter="all"
      selectedTypeFilter="all"
      summary={{
        activeLoanCount: 2,
        lenderCount: 1,
        netRemainingAmount: -120500.75,
        payableRemainingAmount: 660000,
        receivableRemainingAmount: 120500.75,
        remainingAmount: 780500.75,
        trackedLoanCount: 2,
      }}
      {...overrides}
    />,
  );

  return {
    onDirectionFilterChange,
    onLenderFilterChange,
    onResetFilters,
    onTypeFilterChange,
  };
}

describe("MonthlyExpensesLoansReport", () => {
  it("shows the net balance with a leading sign and an explanatory hint when debts exceed receivables", () => {
    renderReport();

    expect(screen.getByText("-$ 120.500,75")).toBeInTheDocument();
    expect(
      screen.getByText(/deb[eé]s m[aá]s de lo que te deben/i),
    ).toBeInTheDocument();
  });

  it("breaks down how much is owed versus receivable using ARS money format", () => {
    renderReport();

    expect(screen.getByText("$ 660.000")).toBeInTheDocument();
    expect(screen.getAllByText("$ 120.500,75")).toHaveLength(2);
  });

  it("describes the owe-versus-receivable split for assistive technology", () => {
    renderReport();

    expect(
      screen.getByRole("img", { name: /yo debo .* me deben/i }),
    ).toBeInTheDocument();
  });

  it("renders each lender entry with its direction and type as separate badges", () => {
    renderReport();

    const entry = screen.getByRole("article");

    expect(within(entry).getByText("Banco Ciudad")).toBeInTheDocument();
    expect(within(entry).getByText("Me deben")).toBeInTheDocument();
    expect(within(entry).getByText("Banco")).toBeInTheDocument();
    expect(within(entry).getByText("Tarjeta")).toBeInTheDocument();
    expect(within(entry).getByText("Seguro")).toBeInTheDocument();
  });

  it("exposes the direction filter as a segmented control and reports the selected value", async () => {
    const { onDirectionFilterChange } = renderReport();

    await userEvent.click(screen.getByRole("tab", { name: "Yo debo" }));

    expect(onDirectionFilterChange).toHaveBeenCalledWith("payable");
  });

  it("resets every filter when the clear action is used", () => {
    const { onResetFilters } = renderReport();

    fireEvent.click(screen.getByRole("button", { name: /limpiar/i }));

    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("shows an empty message when there are no entries and no feedback", () => {
    renderReport({ entries: [] });

    expect(
      screen.getByText("No hay deudas para los filtros seleccionados."),
    ).toBeInTheDocument();
  });
});
