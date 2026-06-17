import {
  createMonthlyExpensesDocument,
  type MonthlyExpenseItemInput,
  type MonthlyExpensesDocument,
} from "../../domain/value-objects/monthly-expenses-document";
import { projectMonthlyExpenseLoans } from "./project-monthly-expense-loans";

function buildDocument(
  month: string,
  items: MonthlyExpenseItemInput[],
): MonthlyExpensesDocument {
  return createMonthlyExpensesDocument({ items, month }, "Building test document");
}

function buildLoanItem(
  overrides: Partial<MonthlyExpenseItemInput> = {},
): MonthlyExpenseItemInput {
  return {
    currency: "ARS",
    description: "Notebook",
    id: "loan-1",
    occurrencesPerMonth: 1,
    subtotal: 1000,
    ...overrides,
    loan: {
      installmentCount: 6,
      startMonth: "2026-03",
      ...overrides.loan,
    },
  };
}

describe("projectMonthlyExpenseLoans", () => {
  it("projects a loan that starts next month into every month within its range", () => {
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-04" } }),
      ]),
    ];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    // 2026-04..2026-09 is the [startMonth, endMonth] range.
    expect(projectInto("2026-04")).toHaveLength(1);
    expect(projectInto("2026-09")).toHaveLength(1);
    // Before the start month and after the end month it is not projected.
    expect(projectInto("2026-03")).toHaveLength(0);
    expect(projectInto("2026-10")).toHaveLength(0);
  });

  it("projects a loan already in progress into previous, current and following months", () => {
    const documents = [
      buildDocument("2026-05", [
        buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
      ]),
    ];

    const projectInto = (targetMonth: string) =>
      projectMonthlyExpenseLoans({ documents, targetMonth, baseItems: [] });

    // Range 2026-03..2026-08, regardless of which month physically holds it.
    expect(projectInto("2026-03")).toHaveLength(1);
    expect(projectInto("2026-04")).toHaveLength(1);
    expect(projectInto("2026-06")).toHaveLength(1);
    expect(projectInto("2026-08")).toHaveLength(1);
    expect(projectInto("2026-02")).toHaveLength(0);
    expect(projectInto("2026-09")).toHaveLength(0);
  });

  it("does not project a loan already present in the target month", () => {
    const targetMonth = "2026-04";
    const targetDocument = buildDocument(targetMonth, [
      buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
    ]);
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({ loan: { installmentCount: 6, startMonth: "2026-03" } }),
      ]),
      targetDocument,
    ];

    const projected = projectMonthlyExpenseLoans({
      documents,
      targetMonth,
      baseItems: targetDocument.items,
    });

    expect(projected).toHaveLength(0);
  });

  it("uses the most recent snapshot as the canonical loan definition", () => {
    const documents = [
      buildDocument("2026-03", [
        buildLoanItem({
          subtotal: 1000,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
      buildDocument("2026-05", [
        buildLoanItem({
          subtotal: 1500,
          loan: { installmentCount: 6, startMonth: "2026-03" },
        }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-04",
      baseItems: [],
    });

    expect(projected?.subtotal).toBe(1500);
  });

  it("projects loans without any per-month payment state", () => {
    const documents = [
      buildDocument("2026-05", [
        buildLoanItem({
          loan: { installmentCount: 6, startMonth: "2026-03" },
          manualCoveredPayments: 1,
          paymentRecords: [
            { coveredPayments: 1, id: "paid-record" },
          ],
        }),
      ]),
    ];

    const [projected] = projectMonthlyExpenseLoans({
      documents,
      targetMonth: "2026-06",
      baseItems: [],
    });

    expect(projected?.id).toBe("loan-1");
    expect(projected?.loan?.startMonth).toBe("2026-03");
    expect(projected?.paymentRecords).toBeUndefined();
    expect(projected?.receipts).toBeUndefined();
    expect(projected?.manualCoveredPayments).toBeUndefined();
    expect(projected?.isPaid).toBeUndefined();
  });

  it("ignores non-loan expenses", () => {
    const documents = [
      buildDocument("2026-05", [
        {
          currency: "ARS",
          description: "Internet",
          id: "expense-1",
          occurrencesPerMonth: 1,
          subtotal: 100,
        },
      ]),
    ];

    expect(
      projectMonthlyExpenseLoans({
        documents,
        targetMonth: "2026-06",
        baseItems: [],
      }),
    ).toHaveLength(0);
  });
});
