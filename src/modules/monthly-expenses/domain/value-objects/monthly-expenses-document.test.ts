import {
  createMonthlyExpensesDocument,
  calculateMonthlyExpenseTotal,
} from "./monthly-expenses-document";

describe("monthlyExpensesDocument", () => {
  it("normalizes expense rows and calculates totals for each item", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "  Empleada domestica  ",
            id: "expense-1",
            occurrencesPerMonth: 8,
            subtotal: 6000,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result).toEqual({
      items: [
        {
          currency: "ARS",
          description: "Empleada domestica",
          id: "expense-1",
          occurrencesPerMonth: 8,
          subtotal: 6000,
          total: 48000,
        },
      ],
      month: "2026-03",
    });
  });

  it("rejects an invalid month before persisting the document", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [],
          month: "03-2026",
        },
        "Saving monthly expenses",
      ),
    ).toThrow("Saving monthly expenses requires a month in YYYY-MM format.");
  });

  it("rejects items without description, subtotal, or monthly occurrences", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "  ",
              id: "expense-1",
              occurrencesPerMonth: 0,
              subtotal: 0,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires every expense to include a description, a subtotal greater than 0, and occurrences per month greater than 0.",
    );
  });

  it("keeps currency totals stable for decimal subtotals", () => {
    expect(
      calculateMonthlyExpenseTotal({
        occurrencesPerMonth: 8,
        subtotal: 2.49,
      }),
    ).toBe(19.92);
  });
});
