import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MonthlyExpensesLoansReport } from "./monthly-expenses-loans-report";

type RenderOverrides = Partial<
  React.ComponentProps<typeof MonthlyExpensesLoansReport>
>;

type ActiveLoan = React.ComponentProps<
  typeof MonthlyExpensesLoansReport
>["entries"][number]["activeLoans"][number];

function buildActiveLoan(overrides: Partial<ActiveLoan> = {}): ActiveLoan {
  return {
    currency: "ARS",
    currentMonthAmount: 10000,
    currentMonthAmountOriginal: null,
    description: "Tarjeta",
    endMonth: "2026-12",
    installmentCount: 12,
    isDueSoon: false,
    paidInstallments: 5,
    remainingAmount: 70500.75,
    remainingAmountOriginal: null,
    ...overrides,
  };
}

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
          activeLoans: [
            buildActiveLoan({ description: "Tarjeta", remainingAmount: 70500.75 }),
            buildActiveLoan({
              description: "Seguro",
              endMonth: "2026-08",
              installmentCount: 6,
              paidInstallments: 2,
              remainingAmount: 50000,
            }),
          ],
          direction: "receivable",
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
        currentMonthAmount: 20000,
        lenderCount: 1,
        monthlyProjection: [
          { amount: 20000, month: "2026-06" },
          { amount: 20000, month: "2026-07" },
        ],
        netRemainingAmount: 539499.25,
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
  it("shows the net balance as the user's position with a leading sign and hint when debts exceed receivables", () => {
    renderReport();

    expect(screen.getByText("-$ 539.499,25")).toBeInTheDocument();
    expect(
      screen.getByText(/deb[eé]s m[aá]s de lo que te deben/i),
    ).toBeInTheDocument();
  });

  it("shows a positive net balance in your favor when receivables exceed debts", () => {
    renderReport({
      summary: {
        activeLoanCount: 1,
        currentMonthAmount: 5000,
        lenderCount: 1,
        monthlyProjection: [],
        netRemainingAmount: -45000,
        payableRemainingAmount: 30000,
        receivableRemainingAmount: 75000,
        remainingAmount: 105000,
        trackedLoanCount: 1,
      },
    });

    expect(screen.getByText("$ 45.000")).toBeInTheDocument();
    expect(
      screen.getByText(/te deben m[aá]s de lo que deb[eé]s/i),
    ).toBeInTheDocument();
  });

  it("describes the owe-versus-receivable split for assistive technology", () => {
    renderReport();

    expect(
      screen.getByRole("img", { name: /yo debo .* me deben/i }),
    ).toBeInTheDocument();
  });

  it("renders each lender entry with its direction, type and active loans", () => {
    renderReport();

    const entry = screen.getByRole("article");

    expect(within(entry).getByText("Banco Ciudad")).toBeInTheDocument();
    expect(within(entry).getByText("Me deben")).toBeInTheDocument();
    expect(within(entry).getByText("Banco")).toBeInTheDocument();
    expect(within(entry).getByText("Tarjeta")).toBeInTheDocument();
    expect(within(entry).getByText("Seguro")).toBeInTheDocument();
  });

  it("shows the installment progress for each active loan", () => {
    renderReport();

    expect(screen.getByText("Cuota 5 de 12")).toBeInTheDocument();
    expect(screen.getByText("Cuota 2 de 6")).toBeInTheDocument();
  });

  it("shows the original USD amount next to the converted ARS amount for USD loans", () => {
    renderReport({
      entries: [
        {
          activeLoanCount: 1,
          activeLoans: [
            buildActiveLoan({
              currency: "USD",
              currentMonthAmount: 100000,
              currentMonthAmountOriginal: 100,
              description: "Iphone",
              installmentCount: 17,
              paidInstallments: 1,
              remainingAmount: 1600000,
              remainingAmountOriginal: 1600,
            }),
          ],
          direction: "payable",
          firstDebtMonth: "2026-06",
          latestRecordedMonth: "2026-06",
          lenderId: "lender-2",
          lenderName: "Camila Morales",
          lenderType: "other",
          remainingAmount: 1700000,
          trackedLoanCount: 1,
        },
      ],
    });

    expect(screen.getByText("US$ 100 → $ 100.000")).toBeInTheDocument();
    expect(
      screen.getByText(/US\$ 1\.600 → \$ 1\.600\.000 en total/),
    ).toBeInTheDocument();
  });

  it("flags active loans whose final installment is due soon", () => {
    renderReport({
      entries: [
        {
          activeLoanCount: 1,
          activeLoans: [
            buildActiveLoan({ description: "Préstamo", isDueSoon: true }),
          ],
          direction: "payable",
          firstDebtMonth: "2026-01",
          latestRecordedMonth: "2026-06",
          lenderId: "lender-3",
          lenderName: "Banco Nación",
          lenderType: "bank",
          remainingAmount: 70500.75,
          trackedLoanCount: 1,
        },
      ],
    });

    expect(screen.getByText("Última cuota")).toBeInTheDocument();
  });

  it("labels the final installment month as finishing instead of last installment", () => {
    renderReport({
      entries: [
        {
          activeLoanCount: 1,
          activeLoans: [
            buildActiveLoan({
              description: "Préstamo",
              installmentCount: 6,
              isDueSoon: true,
              paidInstallments: 6,
              remainingAmount: 0,
            }),
          ],
          direction: "payable",
          firstDebtMonth: "2026-01",
          latestRecordedMonth: "2026-06",
          lenderId: "lender-3",
          lenderName: "Banco Nación",
          lenderType: "bank",
          remainingAmount: 0,
          trackedLoanCount: 1,
        },
      ],
    });

    expect(screen.getByText("Finaliza")).toBeInTheDocument();
    expect(screen.queryByText("Última cuota")).not.toBeInTheDocument();
  });

  it("lists shared descriptions as separate active loan rows", () => {
    renderReport({
      entries: [
        {
          activeLoanCount: 2,
          activeLoans: [
            buildActiveLoan({
              description: "Iphone",
              installmentCount: 17,
              paidInstallments: 3,
              remainingAmount: 1700,
            }),
            buildActiveLoan({
              description: "Iphone",
              installmentCount: 10,
              paidInstallments: 2,
              remainingAmount: 1000,
            }),
          ],
          direction: "payable",
          firstDebtMonth: "2026-06",
          latestRecordedMonth: "2026-06",
          lenderId: "lender-2",
          lenderName: "Camila Morales",
          lenderType: "other",
          remainingAmount: 2700,
          trackedLoanCount: 2,
        },
      ],
    });

    expect(screen.getAllByText("Iphone")).toHaveLength(2);
    expect(screen.getByText("Cuota 3 de 17")).toBeInTheDocument();
    expect(screen.getByText("Cuota 2 de 10")).toBeInTheDocument();
  });

  it("groups entries into 'Yo debo' and 'Me deben' sections", () => {
    renderReport({
      entries: [
        {
          activeLoanCount: 1,
          activeLoans: [buildActiveLoan({ description: "Préstamo" })],
          direction: "payable",
          firstDebtMonth: "2026-01",
          latestRecordedMonth: "2026-06",
          lenderId: "lender-2",
          lenderName: "Banco Nación",
          lenderType: "bank",
          remainingAmount: 70500.75,
          trackedLoanCount: 1,
        },
        {
          activeLoanCount: 1,
          activeLoans: [buildActiveLoan({ description: "Tarjeta" })],
          direction: "receivable",
          firstDebtMonth: "2026-01",
          latestRecordedMonth: "2026-06",
          lenderId: "lender-1",
          lenderName: "Vero",
          lenderType: "family",
          remainingAmount: 50000,
          trackedLoanCount: 1,
        },
      ],
    });

    expect(screen.getByRole("heading", { name: "Yo debo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Me deben" })).toBeInTheDocument();
  });

  it("offers a sort control for the debt listing", () => {
    renderReport();

    expect(screen.getByLabelText("Ordenar deudas")).toBeInTheDocument();
  });

  it("shows the current-month and total-remaining metrics in the header", () => {
    renderReport();

    expect(screen.getByText("Total restante")).toBeInTheDocument();
    expect(screen.getByText("$ 780.500,75")).toBeInTheDocument();
    expect(screen.getByText("$ 20.000")).toBeInTheDocument();
  });

  it("shows each loan's current-month installment and remaining total", () => {
    renderReport();

    expect(
      screen.getByText("Restan 7 · $ 70.500,75 en total"),
    ).toBeInTheDocument();
  });

  it("toggles the card amount between total and current month", async () => {
    renderReport();

    expect(screen.getByText("Este mes $ 20.000")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Este mes" }));

    expect(screen.getByText("Total $ 120.500,75")).toBeInTheDocument();
  });

  it("expands the loan list on demand when there are more than three loans", async () => {
    renderReport({
      entries: [
        {
          activeLoanCount: 5,
          activeLoans: ["Uno", "Dos", "Tres", "Cuatro", "Cinco"].map((name) =>
            buildActiveLoan({ description: name }),
          ),
          direction: "payable",
          firstDebtMonth: "2026-01",
          latestRecordedMonth: "2026-06",
          lenderId: "lender-9",
          lenderName: "Banco Santander",
          lenderType: "bank",
          remainingAmount: 500000,
          trackedLoanCount: 5,
        },
      ],
    });

    expect(screen.queryByText("Cuatro")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "+2 más" }));

    expect(screen.getByText("Cuatro")).toBeInTheDocument();
    expect(screen.getByText("Cinco")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver menos" }),
    ).toBeInTheDocument();
  });

  it("renders an upcoming-payments projection", () => {
    renderReport();

    expect(
      screen.getByText("Lo que pagás los próximos meses"),
    ).toBeInTheDocument();
    expect(screen.getByTitle("06/26: $ 20.000")).toBeInTheDocument();
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
