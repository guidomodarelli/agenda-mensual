import {
  calculateMonthlyExpenseTotal,
  calculateLoanEndMonth,
  calculatePaidLoanInstallments,
  createMonthlyExpensesDocument,
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
            loan: {
              installmentCount: 12,
              lenderName: "  Papa  ",
              startMonth: "2026-01",
            },
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
          loan: {
            endMonth: "2026-12",
            installmentCount: 12,
            lenderName: "Papa",
            paidInstallments: 3,
            startMonth: "2026-01",
          },
          occurrencesPerMonth: 8,
          paymentLink: null,
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

  it("rejects loan items without a valid start month and installment count", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Prestamo tarjeta",
              id: "expense-1",
              loan: {
                installmentCount: 0,
                startMonth: "2026/01",
              },
              occurrencesPerMonth: 1,
              subtotal: 50000,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow(
      "Saving monthly expenses requires a loan start month in YYYY-MM format.",
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

  it("calculates the loan end month from the start month and installments", () => {
    expect(
      calculateLoanEndMonth({
        installmentCount: 12,
        startMonth: "2026-01",
      }),
    ).toBe("2026-12");
  });

  it("calculates paid installments for the visible month and caps them at the total", () => {
    expect(
      calculatePaidLoanInstallments({
        installmentCount: 12,
        startMonth: "2026-01",
        targetMonth: "2026-02",
      }),
    ).toBe(2);

    expect(
      calculatePaidLoanInstallments({
        installmentCount: 12,
        startMonth: "2026-01",
        targetMonth: "2027-02",
      }),
    ).toBe(12);
  });

  it("supports regular expenses without loan metadata", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "USD",
            description: "Google One",
            id: "expense-1",
            occurrencesPerMonth: 1,
            subtotal: 2.49,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]).toEqual({
      currency: "USD",
      description: "Google One",
      id: "expense-1",
      occurrencesPerMonth: 1,
      paymentLink: null,
      subtotal: 2.49,
      total: 2.49,
    });
  });

  it("normalizes payment links and adds https protocol when omitted", () => {
    const result = createMonthlyExpensesDocument(
      {
        items: [
          {
            currency: "ARS",
            description: "Electricidad",
            id: "expense-1",
            occurrencesPerMonth: 1,
            paymentLink: "  pagos.empresa-energia.com  ",
            subtotal: 45,
          },
        ],
        month: "2026-03",
      },
      "Saving monthly expenses",
    );

    expect(result.items[0]?.paymentLink).toBe("https://pagos.empresa-energia.com");
  });

  it("rejects payment links that are not valid URLs", () => {
    expect(() =>
      createMonthlyExpensesDocument(
        {
          items: [
            {
              currency: "ARS",
              description: "Electricidad",
              id: "expense-1",
              occurrencesPerMonth: 1,
              paymentLink: "asdads",
              subtotal: 45,
            },
          ],
          month: "2026-03",
        },
        "Saving monthly expenses",
      ),
    ).toThrow("Saving monthly expenses requires every payment link to be a valid URL.");
  });
});
